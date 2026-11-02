import "server-only"

import { createClient } from "@supabase/supabase-js"

import { env } from "@/lib/env"

import type { Database } from "./database.types"

/**
 * Client cu cheia service_role: ocolește RLS. Folosit EXCLUSIV în webhooks și joburi (cron),
 * după verificarea proprie a cererii. Niciodată în acțiuni ale utilizatorului.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!secretKey)
    throw new Error("Lipsește variabila de mediu SUPABASE_SECRET_KEY (vezi .env.example)")
  return createClient<Database>(env.supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
