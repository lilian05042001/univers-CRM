import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"

import { getAdapter } from "./registry"
import type { ChannelRecord } from "./types"

const MAX_BODY_BYTES = 256 * 1024

export type WebhookOutcome = { status: number; body: Record<string, unknown> }

const reply = (status: number, body: Record<string, unknown>): WebhookOutcome => ({ status, body })

/**
 * Fluxul unui webhook: adaptor → canal → verificare → parsare → webhook_events (deduplicare)
 * → ingest_inbound_message (contact identificat → conversație → mesaj → message.received).
 */
export async function handleWebhook(provider: string, request: Request): Promise<WebhookOutcome> {
  const adapter = getAdapter(provider)
  if (!adapter) return reply(404, { error: "unknown_provider" })

  const rawBody = await request.text()
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) return reply(413, { error: "payload_too_large" })

  const channelId = adapter.resolveChannelId(request)
  if (!channelId) return reply(401, { error: "unauthorized" })

  const admin = createAdminClient()
  const { data: row, error: channelError } = await admin
    .from("channels")
    .select("id, organization_id, provider, status, webhook_secret_hash")
    .eq("id", channelId)
    .eq("provider", provider)
    .maybeSingle()
  if (channelError) throw channelError
  if (!row) return reply(401, { error: "unauthorized" })

  const channel: ChannelRecord = {
    id: row.id,
    organizationId: row.organization_id,
    provider: adapter.provider,
    status: row.status,
    webhookSecretHash: row.webhook_secret_hash,
  }
  // Același răspuns pentru canal inexistent și cheie greșită: nu confirmăm existența canalului.
  if (!adapter.verifyWebhook(request, rawBody, channel))
    return reply(401, { error: "unauthorized" })
  if (adapter.getStatus(channel) !== "active") return reply(409, { error: "channel_inactive" })

  const parsed = adapter.parseInbound(rawBody)
  if (!parsed.ok) return reply(400, { error: parsed.error })

  // Cheia de idempotență e per canal: id-urile evenimentelor vin de la sisteme diferite.
  const eventKey = `${channel.id}:${parsed.event.eventId}`
  const { data: inserted, error: insertError } = await admin
    .from("webhook_events")
    .upsert(
      {
        organization_id: channel.organizationId,
        channel_id: channel.id,
        provider,
        external_event_id: eventKey,
        payload: JSON.parse(rawBody),
        signature_valid: true,
      },
      { onConflict: "provider,external_event_id", ignoreDuplicates: true }
    )
    .select("id")
  if (insertError) throw insertError

  let eventId = inserted[0]?.id
  if (eventId === undefined) {
    const { data: existing, error } = await admin
      .from("webhook_events")
      .select("id, processed_at")
      .eq("provider", provider)
      .eq("external_event_id", eventKey)
      .single()
    if (error) throw error
    if (existing.processed_at) return reply(200, { ok: true, duplicate: true })
    eventId = existing.id // o încercare anterioară a eșuat: se reia
  }

  try {
    const results = []
    for (const message of parsed.event.messages) {
      const { data, error } = await admin.rpc("ingest_inbound_message", {
        p_channel: channel.id,
        p_message: {
          external_id: message.externalId,
          thread_id: message.threadId,
          sender_name: message.sender.name,
          identity_type: message.sender.identityType,
          identity_value: message.sender.identityValue,
          body: message.body,
          sent_at: message.sentAt,
        },
      })
      if (error) throw error
      results.push(data)
    }
    await admin
      .from("webhook_events")
      .update({ processed_at: new Date().toISOString(), error: null })
      .eq("id", eventId)
    return reply(200, { ok: true, results })
  } catch (error) {
    const message = (error as { message?: string })?.message ?? "unexpected"
    await admin
      .from("webhook_events")
      .update({ error: message.slice(0, 1000) })
      .eq("id", eventId)
    console.error("[webhook] processing failed", provider, error)
    return reply(500, { error: "processing_failed" })
  }
}
