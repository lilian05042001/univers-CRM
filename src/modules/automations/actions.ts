"use server"

import { randomUUID } from "node:crypto"

import { z } from "zod"

import { createOrgAction } from "@/lib/actions/action"
import { fail, ok } from "@/lib/actions/result"
import type { Json } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"
import { emptyToNull } from "@/lib/utils/format"

import { actionToJson, conditionsToJson, triggerConfigToJson } from "./mapping"
import { automationSchema } from "./schemas"

const permission = "automations.manage" as const

type JsonObject = { [key: string]: Json | undefined }

export const saveAutomation = createOrgAction(
  { schema: automationSchema, permission },
  async (input, ctx) => {
    const supabase = await createClient()
    const fields = {
      name: input.name,
      description: emptyToNull(input.description),
      trigger_type: input.triggerType,
      trigger_config: triggerConfigToJson(input) as JsonObject,
      conditions: conditionsToJson(input) as unknown as JsonObject,
      actions: input.actions.map(actionToJson) as unknown as JsonObject[],
      pipeline_id: input.pipelineId,
      is_active: input.isActive,
    }

    if (input.id) {
      const { data, error } = await supabase
        .from("automations")
        .update(fields)
        .eq("id", input.id)
        .eq("organization_id", ctx.organizationId)
        .select("id")
      if (error) throw error
      return data.length ? ok({ id: input.id }) : fail("errors.forbidden")
    }

    const id = randomUUID()
    const { error } = await supabase
      .from("automations")
      .insert({ id, organization_id: ctx.organizationId, ...fields })
    if (error) throw error
    return ok({ id })
  }
)

export const setAutomationActive = createOrgAction(
  { schema: z.object({ id: z.uuid(), isActive: z.boolean() }), permission },
  async ({ id, isActive }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("automations")
      .update({ is_active: isActive })
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)

export const deleteAutomation = createOrgAction(
  { schema: z.object({ id: z.uuid() }), permission },
  async ({ id }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("automations")
      .delete()
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)
