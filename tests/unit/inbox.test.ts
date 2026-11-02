import { describe, expect, it } from "vitest"

import { internalAdapter } from "@/lib/channels/internal"
import { getAdapter } from "@/lib/channels/registry"
import type { ChannelRecord } from "@/lib/channels/types"
import { generateSecret, secretMatchesHash, sha256Hex } from "@/lib/utils/secret"
import { matchShortcut } from "@/modules/inbox/components/quick-reply-picker"
import type { QuickReply } from "@/modules/inbox/queries"

const CHANNEL_ID = "6f9619ff-8b86-4d11-b42d-00c04fc964ff"

function request(headers: Record<string, string>) {
  return new Request("http://localhost/api/webhooks/internal", { method: "POST", headers })
}

describe("webhook secrets", () => {
  it("generates long random keys with a prefix", () => {
    const a = generateSecret("whk")
    expect(a).toMatch(/^whk_[\w-]{43}$/)
    expect(generateSecret("whk")).not.toBe(a)
  })

  it("matches a key only against its own hash", () => {
    const secret = generateSecret("whk")
    expect(secretMatchesHash(secret, sha256Hex(secret))).toBe(true)
    expect(secretMatchesHash(`${secret}x`, sha256Hex(secret))).toBe(false)
    expect(secretMatchesHash(secret, null)).toBe(false)
  })
})

describe("internal channel adapter", () => {
  const secret = "demo-webhook-secret"
  const channel: ChannelRecord = {
    id: CHANNEL_ID,
    organizationId: CHANNEL_ID,
    provider: "internal",
    status: "active",
    webhookSecretHash: sha256Hex(secret),
  }

  it("is registered and unknown providers are rejected", () => {
    expect(getAdapter("internal")).toBe(internalAdapter)
    expect(getAdapter("whatsapp")).toBeNull()
    expect(getAdapter("__proto__")).toBeNull()
  })

  it("resolves the channel only from a valid uuid header", () => {
    expect(internalAdapter.resolveChannelId(request({ "x-channel-id": CHANNEL_ID }))).toBe(
      CHANNEL_ID
    )
    expect(internalAdapter.resolveChannelId(request({ "x-channel-id": "1 or 1=1" }))).toBeNull()
    expect(internalAdapter.resolveChannelId(request({}))).toBeNull()
  })

  it("verifies the bearer key against the stored hash", () => {
    const ok = request({ authorization: `Bearer ${secret}` })
    expect(internalAdapter.verifyWebhook(ok, "", channel)).toBe(true)
    expect(
      internalAdapter.verifyWebhook(request({ authorization: "Bearer gresit" }), "", channel)
    ).toBe(false)
    expect(internalAdapter.verifyWebhook(request({}), "", channel)).toBe(false)
    expect(internalAdapter.verifyWebhook(ok, "", { ...channel, webhookSecretHash: null })).toBe(
      false
    )
  })

  it("normalizes the sender phone to E.164 and keeps ids for deduplication", () => {
    const result = internalAdapter.parseInbound(
      JSON.stringify({ id: "f-1", sender: { name: "Ion", phone: "069 123 456" }, text: " Salut " })
    )
    expect(result).toEqual({
      ok: true,
      event: {
        eventId: "f-1",
        messages: [
          {
            externalId: "internal:f-1",
            threadId: null,
            sender: { name: "Ion", identityType: "phone", identityValue: "+37369123456" },
            body: "Salut",
            sentAt: null,
          },
        ],
      },
    })
  })

  it("falls back to the lowercased email", () => {
    const result = internalAdapter.parseInbound(
      JSON.stringify({ id: "f-2", sender: { email: "Client@Exemplu.MD" }, text: "Ofertă" })
    )
    expect(result.ok && result.event.messages[0]!.sender).toEqual({
      name: null,
      identityType: "email",
      identityValue: "client@exemplu.md",
    })
  })

  it("rejects invalid JSON, missing sender identity and empty text", () => {
    expect(internalAdapter.parseInbound("{")).toEqual({ ok: false, error: "invalid_json" })
    for (const body of [
      { id: "x", sender: { name: "Fără contact" }, text: "Salut" },
      { id: "x", sender: { phone: "069123456" }, text: "   " },
      { sender: { phone: "069123456" }, text: "Fără id" },
    ]) {
      expect(internalAdapter.parseInbound(JSON.stringify(body))).toEqual({
        ok: false,
        error: "invalid_payload",
      })
    }
  })
})

describe("quick reply shortcuts", () => {
  const replies: QuickReply[] = [
    { id: "1", title: "Ofertă", shortcut: "oferta", body: "V-am trimis oferta.", ownerId: null },
    { id: "2", title: "Program", shortcut: "program", body: "Luni–vineri.", ownerId: null },
    { id: "3", title: "Fără scurtătură", shortcut: null, body: "Text", ownerId: null },
  ]

  it("suggests replies while typing /shortcut at the start of an empty message", () => {
    expect(matchShortcut("/", replies).map((r) => r.id)).toEqual(["1", "2"])
    expect(matchShortcut("/of", replies).map((r) => r.id)).toEqual(["1"])
  })

  it("stays quiet for normal text", () => {
    expect(matchShortcut("Bună /of", replies)).toEqual([])
    expect(matchShortcut("/of ceva", replies)).toEqual([])
    expect(matchShortcut("", replies)).toEqual([])
  })
})
