import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { connection } from "next/server"

import { env } from "@/lib/env"

import type { Database } from "./database.types"

/** Client Supabase cu sesiunea utilizatorului curent (RLS se aplică). */
export async function createClient() {
  const cookieStore = await cookies()
  // Clientul verifică expirarea sesiunii cu Date.now(): datele utilizatorului se calculează
  // doar la cerere, niciodată în prerandarea (runtime prefetch) a rutei.
  await connection()

  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Apelat dintr-un Server Component: cookie-urile nu pot fi scrise aici,
          // dar proxy.ts reîmprospătează sesiunea la fiecare cerere.
        }
      },
    },
  })
}
