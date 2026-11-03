import "server-only"

import { headers } from "next/headers"

import { createAdminClient } from "@/lib/supabase/admin"

/** Limitele aplicației: număr de cereri pe fereastră (secunde). */
export const RATE_LIMITS = {
  /** Încercări de autentificare de la aceeași adresă IP (AUTH_RATE_LIMIT_PER_IP: doar pentru teste). */
  authIp: { limit: Number(process.env.AUTH_RATE_LIMIT_PER_IP) || 20, windowSeconds: 300 },
  /** Încercări de autentificare pentru același e-mail (protecție la ghicirea parolei). */
  authEmail: { limit: 10, windowSeconds: 900 },
  /** Cereri ale unei chei API. */
  apiKey: { limit: 120, windowSeconds: 60 },
  /** Webhook-uri primite pe un canal. */
  webhook: { limit: 300, windowSeconds: 60 },
} as const

export type RateLimitResult = { allowed: boolean; retryAfter: number }

/**
 * Înregistrează o cerere și spune dacă mai e permisă. Dacă baza de date nu răspunde,
 * cererea trece (limitarea nu trebuie să blocheze aplicația), cu eroare în jurnal.
 */
export async function hitRateLimit(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number }
): Promise<RateLimitResult> {
  const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error || !data?.[0]) {
    console.error("[rate-limit] unavailable", error)
    return { allowed: true, retryAfter: 0 }
  }
  return { allowed: data[0].allowed, retryAfter: data[0].retry_after }
}

/** Adresa clientului (primul IP din X-Forwarded-For, setat de Vercel / proxy). */
export function clientIp(source: Headers): string {
  const forwarded = source.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || source.get("x-real-ip") || "unknown"
}

/** Pentru Server Actions de autentificare: limită pe IP și, opțional, pe e-mail. */
export async function authAttemptAllowed(action: string, email?: string): Promise<boolean> {
  const ip = clientIp(await headers())
  const byIp = await hitRateLimit(`auth:${action}:ip:${ip}`, RATE_LIMITS.authIp)
  if (!byIp.allowed) return false
  if (!email) return true
  const byEmail = await hitRateLimit(
    `auth:${action}:email:${email.trim().toLowerCase()}`,
    RATE_LIMITS.authEmail
  )
  return byEmail.allowed
}
