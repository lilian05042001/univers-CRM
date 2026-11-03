import "server-only"

import { unstable_rethrow } from "next/navigation"
import { connection } from "next/server"

import { hitRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit"
import { createAdminClient } from "@/lib/supabase/admin"
import { sha256Hex } from "@/lib/utils/secret"

import { ApiError, errorResponse, mapDbError } from "./http"
import type { ApiScope } from "./scopes"

export type Admin = ReturnType<typeof createAdminClient>

/** Contextul unei cereri autentificate: organizația cheii; fiecare interogare filtrează pe ea. */
export type ApiContext = {
  db: Admin
  keyId: string
  organizationId: string
  scopes: string[]
  /** Autorul cheii: apare ca „creat de” pe înregistrările create prin API. */
  actorId: string
}

async function authenticate(request: Request): Promise<ApiContext> {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  if (!match || match[1]!.length > 200) throw new ApiError(401, "unauthorized")

  const db = createAdminClient()
  const { data, error } = await db.rpc("authenticate_api_key", { p_hash: sha256Hex(match[1]!) })
  if (error) throw error
  const key = data[0]
  if (!key) throw new ApiError(401, "unauthorized")
  return {
    db,
    keyId: key.key_id,
    organizationId: key.organization_id,
    scopes: key.scopes,
    actorId: key.created_by,
  }
}

type Handler<P> = (request: Request, ctx: ApiContext, params: P) => Promise<Response>

/** Route handler al API-ului v1: cheie API (Bearer) → limită de cereri → scope → handler; erori ca JSON. */
export function withApiKey<P = Record<string, never>>(scope: ApiScope, handler: Handler<P>) {
  return async (request: Request, route?: { params: Promise<P> }): Promise<Response> => {
    // Răspunsurile depind de cheie și de date: niciodată prerandate sau memorate.
    await connection()
    try {
      const ctx = await authenticate(request)
      const limit = await hitRateLimit(`api:${ctx.keyId}`, RATE_LIMITS.apiKey)
      if (!limit.allowed) throw new ApiError(429, "rate_limited", undefined, limit.retryAfter)
      if (!ctx.scopes.includes(scope)) throw new ApiError(403, "insufficient_scope")
      const params = route ? await route.params : ({} as P)
      return await handler(request, ctx, params)
    } catch (error) {
      unstable_rethrow(error)
      return errorResponse(mapDbError(error))
    }
  }
}
