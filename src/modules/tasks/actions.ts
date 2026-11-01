"use server"

import { createOrgAction } from "@/lib/actions/action"
import { ok } from "@/lib/actions/result"
import { refFields } from "@/lib/crm/record-ref"
import { createClient } from "@/lib/supabase/server"
import { emptyToNull } from "@/lib/utils/format"
import { zonedInputToUtc } from "@/lib/utils/timezone"

import { taskSchema, taskStatusSchema } from "./schemas"

export const saveTask = createOrgAction({ schema: taskSchema }, async (input, ctx) => {
  const supabase = await createClient()
  const fields = {
    title: input.title,
    description: emptyToNull(input.description),
    type_id: input.typeId,
    responsible_id: input.responsibleId,
    due_at: zonedInputToUtc(input.dueAt, ctx.membership.organization.timezone).toISOString(),
    duration_minutes: input.durationMinutes ? Number(input.durationMinutes) : null,
    priority: input.priority,
  }

  if (input.id) {
    const { error } = await supabase
      .from("tasks")
      .update(fields)
      .eq("id", input.id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }

  const { error } = await supabase.from("tasks").insert({
    id: crypto.randomUUID(),
    organization_id: ctx.organizationId,
    ...fields,
    ...(input.ref && refFields(input.ref)),
  })
  if (error) throw error
  return ok()
})

/** Finalizare / anulare / redeschidere. Data finalizării e setată de DB. */
export const setTaskStatus = createOrgAction(
  { schema: taskStatusSchema },
  async ({ id, status, result }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("tasks")
      .update({ status, ...(result !== undefined && { result: emptyToNull(result) }) })
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)
