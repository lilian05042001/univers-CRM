"use server"

import { z } from "zod"

import { createOrgAction } from "@/lib/actions/action"
import { fail, ok } from "@/lib/actions/result"
import { API_KEY_PREFIX, API_KEY_VISIBLE_CHARS } from "@/lib/api/scopes"
import { createClient } from "@/lib/supabase/server"
import { generateSecret, sha256Hex } from "@/lib/utils/secret"

import { apiKeySchema } from "./schemas"

const DAY_MS = 24 * 60 * 60 * 1000

/** Cheie nouă: se întoarce o singură dată; în DB rămân prefixul vizibil și hash-ul sha256. */
export const createApiKey = createOrgAction(
  { schema: apiKeySchema, permission: "api_keys.manage" },
  async ({ name, scopes, expiresIn }, ctx) => {
    const secret = generateSecret(API_KEY_PREFIX)
    const supabase = await createClient()
    const { error } = await supabase.from("api_keys").insert({
      organization_id: ctx.organizationId,
      name,
      scopes,
      key_prefix: secret.slice(0, API_KEY_VISIBLE_CHARS),
      key_hash: sha256Hex(secret),
      expires_at:
        expiresIn === "never"
          ? null
          : new Date(Date.now() + Number(expiresIn) * DAY_MS).toISOString(),
    })
    if (error) throw error
    return ok({ secret })
  }
)

export const revokeApiKey = createOrgAction(
  { schema: z.object({ id: z.uuid() }), permission: "api_keys.manage" },
  async ({ id }, ctx) => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .is("revoked_at", null)
      .select("id")
    if (error) throw error
    return data.length ? ok() : fail("errors.forbidden")
  }
)
