"use server"

import { randomBytes } from "node:crypto"

import { createOrgAction } from "@/lib/actions/action"
import { ok } from "@/lib/actions/result"
import { createClient } from "@/lib/supabase/server"
import { technicalKey } from "@/lib/utils/search"

import {
  customFieldSchema,
  deleteByIdSchema,
  sourceSchema,
  splitOptions,
  tagSchema,
} from "./schemas"

const perm = "settings.manage" as const

export const saveTag = createOrgAction(
  { schema: tagSchema, permission: perm },
  async ({ id, name, color }, ctx) => {
    const supabase = await createClient()
    const { error } = id
      ? await supabase
          .from("tags")
          .update({ name, color })
          .eq("id", id)
          .eq("organization_id", ctx.organizationId)
      : await supabase.from("tags").insert({ organization_id: ctx.organizationId, name, color })
    if (error) throw error
    return ok()
  }
)

export const deleteTag = createOrgAction(
  { schema: deleteByIdSchema, permission: perm },
  async ({ id }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("tags")
      .delete()
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)

export const saveSource = createOrgAction(
  { schema: sourceSchema, permission: perm },
  async ({ id, name, channel, isActive }, ctx) => {
    const supabase = await createClient()
    const fields = { name, channel, is_active: isActive }
    const { error } = id
      ? await supabase
          .from("lead_sources")
          .update(fields)
          .eq("id", id)
          .eq("organization_id", ctx.organizationId)
      : await supabase
          .from("lead_sources")
          .insert({ organization_id: ctx.organizationId, ...fields, position: 100 })
    if (error) throw error
    return ok()
  }
)

export const deleteSource = createOrgAction(
  { schema: deleteByIdSchema, permission: perm },
  async ({ id }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("lead_sources")
      .delete()
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)

/** Cheia tehnică a câmpului: derivată din etichetă la creare, apoi fixă (valorile salvate depind de ea). */
const fieldKey = (label: string) => technicalKey(label, "f", randomBytes(2).toString("hex"))

export const saveCustomField = createOrgAction(
  { schema: customFieldSchema, permission: perm },
  async ({ id, entity, label, type, options, isRequired }, ctx) => {
    const supabase = await createClient()
    const fields = {
      label,
      type,
      options: ["select", "multiselect"].includes(type) ? splitOptions(options) : [],
      is_required: isRequired,
    }
    const { error } = id
      ? await supabase
          .from("custom_field_definitions")
          .update(fields)
          .eq("id", id)
          .eq("organization_id", ctx.organizationId)
      : await supabase.from("custom_field_definitions").insert({
          organization_id: ctx.organizationId,
          entity,
          key: fieldKey(label),
          ...fields,
          position: 100,
        })
    if (error) throw error
    return ok()
  }
)

export const deleteCustomField = createOrgAction(
  { schema: deleteByIdSchema, permission: perm },
  async ({ id }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("custom_field_definitions")
      .delete()
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)
