"use client"

import { createBrowserClient } from "@supabase/ssr"

import { env } from "@/lib/env"

import type { Database } from "./database.types"

let client: ReturnType<typeof createBrowserClient<Database>> | undefined

/** Client Supabase în browser (sesiunea din cookie-uri; RLS se aplică). Folosit pentru Storage și Realtime. */
export function getBrowserClient() {
  client ??= createBrowserClient<Database>(env.supabaseUrl, env.supabasePublishableKey)
  return client
}
