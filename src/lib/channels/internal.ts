import { z } from "zod"

import { normalizePhone } from "@/lib/utils/phone"
import { secretMatchesHash } from "@/lib/utils/secret"

import { CHANNEL_HEADER } from "./constants"
import type { ChannelAdapter, ParseResult } from "./types"

/**
 * Corpul acceptat de canalul intern (formular web, integrare proprie, mesaj introdus de alt sistem):
 * { id, thread_id?, sender: { name?, phone?, email? }, text, sent_at? }
 */
const inboundSchema = z.object({
  id: z.string().trim().min(1).max(150),
  thread_id: z.string().trim().min(1).max(150).optional(),
  sender: z
    .object({
      name: z.string().trim().max(160).optional(),
      phone: z.string().trim().min(3).max(40).optional(),
      email: z.email().max(254).optional(),
    })
    .refine((s) => s.phone || s.email, { error: "sender.phone or sender.email is required" }),
  text: z.string().trim().min(1).max(10000),
  sent_at: z.iso.datetime({ offset: true }).optional(),
})

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  return match?.[1] ?? null
}

/** Canalul intern: autentificare cu cheia webhook a canalului (Bearer), comparată cu hash-ul stocat. */
export const internalAdapter: ChannelAdapter = {
  provider: "internal",

  resolveChannelId(request) {
    const id = request.headers.get(CHANNEL_HEADER)
    return id && z.uuid().safeParse(id).success ? id : null
  },

  verifyWebhook(request, _rawBody, channel) {
    const token = bearer(request)
    return Boolean(token) && secretMatchesHash(token!, channel.webhookSecretHash)
  },

  parseInbound(rawBody): ParseResult {
    let json: unknown
    try {
      json = JSON.parse(rawBody)
    } catch {
      return { ok: false, error: "invalid_json" }
    }
    const parsed = inboundSchema.safeParse(json)
    if (!parsed.success) return { ok: false, error: "invalid_payload" }

    const { id, thread_id, sender, text, sent_at } = parsed.data
    const identity = sender.phone
      ? { identityType: "phone" as const, identityValue: normalizePhone(sender.phone) }
      : { identityType: "email" as const, identityValue: sender.email!.toLowerCase() }

    return {
      ok: true,
      event: {
        eventId: id,
        messages: [
          {
            externalId: `internal:${id}`,
            threadId: thread_id ?? null,
            sender: { name: sender.name || null, ...identity },
            body: text,
            sentAt: sent_at ?? null,
          },
        ],
      },
    }
  },

  // Canalul intern nu are destinatar extern: mesajele agenților sunt „trimise” la salvare.
  async send() {
    return { externalId: null }
  },

  getStatus(channel) {
    return channel.status === "active" ? "active" : "disconnected"
  },
}
