"use server"

import { randomUUID } from "node:crypto"

import { z } from "zod"

import { createOrgAction } from "@/lib/actions/action"
import { fail, ok } from "@/lib/actions/result"
import { addTag, idsSchema, syncTags } from "@/lib/crm/records"
import { createClient } from "@/lib/supabase/server"
import { emptyToNull } from "@/lib/utils/format"
import { writeContactIdentities } from "@/modules/contacts/service"
import { parseCustomFields, prefixFieldErrors } from "@/modules/crm-config/custom-fields"
import { getCrmOptions } from "@/modules/crm-config/queries"

import { leadSchema, parseAmount } from "./schemas"

export const saveLead = createOrgAction({ schema: leadSchema }, async (input, ctx) => {
  if (!ctx.can(input.id ? "leads.edit" : "leads.create")) return fail("errors.forbidden")

  const options = await getCrmOptions(ctx.organizationId)
  const stage = options.pipelines
    .find((p) => p.id === input.pipelineId)
    ?.stages.find((s) => s.id === input.stageId)
  if (!stage) return fail("errors.validation", { stageId: "validation.required" })
  if (stage.kind === "lost" && !input.lossReasonId) {
    return fail("errors.validation", { lossReasonId: "validation.lossReason" })
  }
  if (
    !input.contactId &&
    !input.newContactName &&
    (input.newContactPhone || input.newContactEmail)
  ) {
    return fail("errors.validation", { newContactName: "validation.contactName" })
  }

  const custom = parseCustomFields(
    options.customFields.filter((d) => d.entity === "lead"),
    input.customFields
  )
  if (!custom.ok) return fail("errors.validation", prefixFieldErrors("customFields", custom.errors))

  const supabase = await createClient()

  // Contact nou creat odată cu lead-ul.
  let contactId = input.contactId
  if (!contactId && input.newContactName) {
    if (!ctx.can("contacts.create")) return fail("errors.forbidden")
    const [firstName, ...rest] = input.newContactName.split(/\s+/)
    contactId = randomUUID()
    const { error } = await supabase.from("contacts").insert({
      id: contactId,
      organization_id: ctx.organizationId,
      first_name: firstName ?? "",
      last_name: rest.join(" "),
      company_id: input.companyId,
      source_id: input.sourceId,
      owner_id: input.responsibleId,
    })
    if (error) throw error
    await writeContactIdentities(
      ctx.organizationId,
      contactId,
      [input.newContactPhone],
      [input.newContactEmail]
    )
  }

  const id = input.id ?? randomUUID()
  const fields = {
    title: input.title,
    pipeline_id: input.pipelineId,
    stage_id: input.stageId,
    value: parseAmount(input.value),
    company_id: input.companyId,
    source_id: input.sourceId,
    responsible_id: input.responsibleId,
    team_id: input.teamId,
    priority: input.priority,
    description: emptyToNull(input.description),
    loss_reason_id: stage.kind === "lost" ? input.lossReasonId : null,
    loss_comment: stage.kind === "lost" ? emptyToNull(input.lossComment) : null,
    custom_fields: custom.data,
  }

  if (input.id) {
    const { error } = await supabase
      .from("leads")
      .update(fields)
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
  } else {
    // loss_* nu se pot seta la inserare (coloane permise doar la update), deci se completează după.
    const { loss_reason_id, loss_comment, ...insertFields } = fields
    const { error } = await supabase.from("leads").insert({
      id,
      organization_id: ctx.organizationId,
      currency: ctx.membership.organization.currency,
      ...insertFields,
    })
    if (error) throw error
    if (loss_reason_id) {
      const { error: e } = await supabase
        .from("leads")
        .update({ loss_reason_id, loss_comment })
        .eq("id", id)
      if (e) throw e
    }
  }

  // Contactul principal al lead-ului.
  const { error: unlinkError } = await supabase
    .from("lead_contacts")
    .delete()
    .eq("lead_id", id)
    .eq("is_primary", true)
    .neq("contact_id", contactId ?? "00000000-0000-0000-0000-000000000000")
  if (unlinkError) throw unlinkError
  if (contactId) {
    // Fără upsert: ON CONFLICT DO UPDATE ar rescrie și coloanele imuabile (organization_id).
    const { error } = await supabase.from("lead_contacts").upsert(
      {
        organization_id: ctx.organizationId,
        lead_id: id,
        contact_id: contactId,
        is_primary: true,
      },
      { onConflict: "lead_id,contact_id", ignoreDuplicates: true }
    )
    if (error) throw error
    const { error: primaryError } = await supabase
      .from("lead_contacts")
      .update({ is_primary: true })
      .eq("lead_id", id)
      .eq("contact_id", contactId)
    if (primaryError) throw primaryError
  }

  await syncTags("lead_tags", "lead_id", ctx.organizationId, id, input.tagIds)
  return ok({ id })
})

export const deleteLeads = createOrgAction(
  { schema: z.object({ ids: idsSchema }), permission: "leads.delete" },
  async ({ ids }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("leads")
      .update({ deleted_at: new Date().toISOString() })
      .eq("organization_id", ctx.organizationId)
      .in("id", ids)
    if (error) throw error
    return ok()
  }
)

export const assignLeads = createOrgAction(
  {
    schema: z.object({ ids: idsSchema, responsibleId: z.uuid().nullable() }),
    permission: "leads.assign",
  },
  async ({ ids, responsibleId }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("leads")
      .update({ responsible_id: responsibleId })
      .eq("organization_id", ctx.organizationId)
      .in("id", ids)
    if (error) throw error
    return ok()
  }
)

/** Mută lead-urile într-o etapă (eventual din alt pipeline). „Pierdut” cere motivul. */
export const moveLeads = createOrgAction(
  {
    schema: z.object({
      ids: idsSchema,
      stageId: z.uuid(),
      lossReasonId: z.uuid().nullable().optional(),
    }),
    permission: "leads.edit",
  },
  async ({ ids, stageId, lossReasonId }, ctx) => {
    const options = await getCrmOptions(ctx.organizationId)
    const pipeline = options.pipelines.find((p) => p.stages.some((s) => s.id === stageId))
    const stage = pipeline?.stages.find((s) => s.id === stageId)
    if (!pipeline || !stage) return fail("errors.validation")
    if (stage.kind === "lost" && !lossReasonId) return fail("errors.lossReasonRequired")

    const supabase = await createClient()
    const { error } = await supabase
      .from("leads")
      .update({
        pipeline_id: pipeline.id,
        stage_id: stageId,
        ...(stage.kind === "lost" && { loss_reason_id: lossReasonId }),
      })
      .eq("organization_id", ctx.organizationId)
      .in("id", ids)
    if (error) throw error
    return ok()
  }
)

export const tagLeads = createOrgAction(
  { schema: z.object({ ids: idsSchema, tagId: z.uuid() }), permission: "leads.edit" },
  async ({ ids, tagId }, ctx) => {
    await addTag("lead_tags", "lead_id", ctx.organizationId, ids, tagId)
    return ok()
  }
)
