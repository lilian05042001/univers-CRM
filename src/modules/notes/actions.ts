"use server"

import { z } from "zod"

import { createOrgAction } from "@/lib/actions/action"
import { ok } from "@/lib/actions/result"
import { recordRefSchema, refFields } from "@/lib/crm/record-ref"
import { createClient } from "@/lib/supabase/server"

const body = z
  .string()
  .trim()
  .min(1, { error: "validation.required" })
  .max(10000, { error: "validation.tooLong" })

export const addNote = createOrgAction(
  { schema: z.object({ ref: recordRefSchema, body }) },
  async ({ ref, body }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("notes")
      .insert({ organization_id: ctx.organizationId, body, ...refFields(ref) })
    if (error) throw error
    return ok()
  }
)

/** Editare / fixare: RLS permite doar autorului (sau administratorului). */
export const updateNote = createOrgAction(
  { schema: z.object({ id: z.uuid(), body: body.optional(), isPinned: z.boolean().optional() }) },
  async ({ id, body, isPinned }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("notes")
      .update({
        ...(body !== undefined && { body }),
        ...(isPinned !== undefined && { is_pinned: isPinned }),
      })
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)

export const deleteNote = createOrgAction(
  { schema: z.object({ id: z.uuid() }) },
  async ({ id }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)
