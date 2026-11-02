import { internalAdapter } from "./internal"
import type { ChannelAdapter } from "./types"

/**
 * Adaptoarele disponibile, după furnizor (segmentul din /api/webhooks/[provider]).
 * WhatsApp / Instagram / Messenger / e-mail / telefonie se adaugă aici, prin API-urile oficiale.
 */
const ADAPTERS: Record<string, ChannelAdapter> = {
  internal: internalAdapter,
}

export function getAdapter(provider: string): ChannelAdapter | null {
  return Object.hasOwn(ADAPTERS, provider) ? ADAPTERS[provider]! : null
}
