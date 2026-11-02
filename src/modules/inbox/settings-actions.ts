"use server"

import { z } from "zod"

import { createOrgAction } from "@/lib/actions/action"
import { fail, ok } from "@/lib/actions/result"
import { createClient } from "@/lib/supabase/server"
import { emptyToNull } from "@/lib/utils/format"
import { generateSecret, sha256Hex } from "@/lib/utils/secret"

import { channelSchema, quickReplySchema } from "./schemas"

/** Răspunsurile partajate cer settings.manage; cele personale aparțin autorului (RLS). */
export const saveQuickReply = createOrgAction(
  { schema: quickReplySchema },
  async ({ id, title, shortcut, body, shared }, ctx) => {
    if (shared && !ctx.can("settings.manage")) return fail("errors.forbidden")
    const supabase = await createClient()
    const fields = { title, shortcut: emptyToNull(shortcut), body }

    if (id) {
      const { data, error } = await supabase
        .from("quick_replies")
        .update(fields)
        .eq("id", id)
        .eq("organization_id", ctx.organizationId)
        .select("id")
      if (error) throw error
      return data.length ? ok() : fail("errors.forbidden")
    }

    const { error } = await supabase.from("quick_replies").insert({
      organization_id: ctx.organizationId,
      owner_id: shared ? null : ctx.user.id,
      ...fields,
    })
    if (error) throw error
    return ok()
  }
)

export const deleteQuickReply = createOrgAction(
  { schema: z.object({ id: z.uuid() }) },
  async ({ id }, ctx) => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("quick_replies")
      .delete()
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .select("id")
    if (error) throw error
    return data.length ? ok() : fail("errors.forbidden")
  }
)

export const renameChannel = createOrgAction(
  { schema: channelSchema, permission: "settings.manage" },
  async ({ id, name }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("channels")
      .update({ name })
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)

/** Cheie webhook nouă: se întoarce o singură dată; în DB rămâne doar hash-ul. Cheia veche nu mai e valabilă. */
export const rotateWebhookSecret = createOrgAction(
  { schema: z.object({ id: z.uuid() }), permission: "settings.manage" },
  async ({ id }, ctx) => {
    const secret = generateSecret("whk")
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("channels")
      .update({ webhook_secret_hash: sha256Hex(secret) })
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .select("id")
    if (error) throw error
    return data.length ? ok({ secret }) : fail("errors.forbidden")
  }
)
