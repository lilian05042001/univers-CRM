export const CHANNEL_PROVIDERS = [
  "internal",
  "whatsapp",
  "instagram",
  "messenger",
  "email",
  "telephony",
  "web_form",
] as const
export type ChannelProvider = (typeof CHANNEL_PROVIDERS)[number]

export const IDENTITY_TYPES = [
  "phone",
  "email",
  "whatsapp",
  "instagram",
  "messenger",
  "telegram",
] as const
export type IdentityType = (typeof IDENTITY_TYPES)[number]

/** Mesaj primit, în forma comună tuturor canalelor (intrarea pentru public.ingest_inbound_message). */
export type NormalizedMessage = {
  /** Id-ul mesajului în canal: deduplicare. */
  externalId: string
  /** Firul conversației în canal; lipsă = un fir per contact. */
  threadId: string | null
  sender: { name: string | null; identityType: IdentityType; identityValue: string }
  body: string
  sentAt: string | null
}

/** Canalul căruia îi aparține cererea, așa cum îl vede adaptorul. */
export type ChannelRecord = {
  id: string
  organizationId: string
  provider: ChannelProvider
  status: string
  webhookSecretHash: string | null
}

export type InboundEvent = {
  /** Id-ul evenimentului: cheia de idempotență din webhook_events. */
  eventId: string
  messages: NormalizedMessage[]
}

export type ParseResult = { ok: true; event: InboundEvent } | { ok: false; error: string }

/**
 * Contractul unui canal. Adaptoarele pentru furnizori externi (WhatsApp Cloud API, Meta, e-mail)
 * implementează aceeași interfață, cu verificarea semnăturii specifică furnizorului.
 */
export interface ChannelAdapter {
  provider: ChannelProvider
  /** Canalul vizat de cerere (din antet / URL / corp), înainte de verificare. */
  resolveChannelId(request: Request): string | null
  /** Autenticitatea cererii (semnătură / cheie), pe baza datelor canalului. */
  verifyWebhook(request: Request, rawBody: string, channel: ChannelRecord): boolean
  parseInbound(rawBody: string): ParseResult
  /** Livrarea unui mesaj trimis de agent (folosită de worker, Etapa 9). */
  send(message: {
    conversationThreadId: string
    body: string
  }): Promise<{ externalId: string | null }>
  getStatus(channel: ChannelRecord): "active" | "disconnected" | "error"
}
