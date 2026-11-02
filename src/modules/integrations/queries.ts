import "server-only"

import { createClient } from "@/lib/supabase/server"

export type ApiKeyStatus = "active" | "revoked" | "expired"

export type ApiKeyRow = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  status: ApiKeyStatus
  expiresAt: string | null
  lastUsedAt: string | null
  author: string | null
  createdAt: string
}

export async function listApiKeys(organizationId: string): Promise<ApiKeyRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("api_keys")
    .select(
      "id, name, key_prefix, scopes, expires_at, revoked_at, last_used_at, created_at, author:profiles(full_name, email)"
    )
    .eq("organization_id", organizationId)
    .order("revoked_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false })
  if (error) throw error

  const now = Date.now()
  return data.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.key_prefix,
    scopes: k.scopes,
    status: k.revoked_at
      ? "revoked"
      : k.expires_at && new Date(k.expires_at).getTime() <= now
        ? "expired"
        : "active",
    expiresAt: k.expires_at,
    lastUsedAt: k.last_used_at,
    author: k.author ? k.author.full_name || k.author.email : null,
    createdAt: k.created_at,
  }))
}
