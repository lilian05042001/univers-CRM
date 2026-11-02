import "server-only"

import { randomUUID } from "node:crypto"

import { searchFilter } from "@/lib/crm/records"

import type { ApiContext } from "./auth"
import { ApiError, type ListQuery } from "./http"
import { assertInOrg, notFound, replaceLinks, resolveCustomFields } from "./records"
import type { LeadInput } from "./schemas"

const LEAD_SELECT =
  "id, title, pipeline_id, stage_id, status, value, currency, won_amount, company_id, source_id, responsible_id, team_id, priority, description, loss_reason_id, custom_fields, created_at, updated_at, closed_at, contacts:lead_contacts(contact_id, is_primary), tags:lead_tags(tag_id)"

function leadsQuery(ctx: ApiContext, count?: "exact") {
  return ctx.db
    .from("leads")
    .select(LEAD_SELECT, { count })
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
}

type LeadData = NonNullable<Awaited<ReturnType<typeof leadsQuery>>["data"]>[number]

function toLead(l: LeadData) {
  const { contacts, tags, ...rest } = l
  return {
    ...rest,
    value: Number(l.value),
    won_amount: l.won_amount === null ? null : Number(l.won_amount),
    contact_ids: [...contacts]
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
      .map((c) => c.contact_id),
    tag_ids: tags.map((t) => t.tag_id),
  }
}

export type LeadFilters = { status?: "open" | "won" | "lost"; pipeline_id?: string }

export async function listLeads(ctx: ApiContext, query: ListQuery, filters: LeadFilters) {
  let q = leadsQuery(ctx, "exact")
  if (query.q) q = q.or(searchFilter(query.q))
  if (query.updated_since) q = q.gte("updated_at", query.updated_since)
  if (filters.status) q = q.eq("status", filters.status)
  if (filters.pipeline_id) q = q.eq("pipeline_id", filters.pipeline_id)
  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .order("id")
    .range(query.offset, query.offset + query.limit - 1)
  if (error) throw error
  return { data: data.map(toLead), total: count ?? 0 }
}

export async function getLead(ctx: ApiContext, id: string) {
  const { data, error } = await leadsQuery(ctx).eq("id", id).maybeSingle()
  if (error) throw error
  return data ? toLead(data) : notFound()
}

/**
 * Etapa lead-ului: cea cerută (trebuie să fie în pipeline), altfel prima etapă a pipeline-ului
 * (implicit: pipeline-ul principal al organizației).
 */
async function resolveStage(ctx: ApiContext, pipelineId?: string, stageId?: string) {
  let query = ctx.db
    .from("pipeline_stages")
    .select("id, pipeline_id, kind, pipeline:pipelines!inner(is_default, archived_at)")
    .eq("organization_id", ctx.organizationId)
    .is("pipeline.archived_at", null)
  if (stageId) query = query.eq("id", stageId)
  else if (pipelineId) query = query.eq("pipeline_id", pipelineId)
  else query = query.eq("pipeline.is_default", true)
  const { data, error } = await query.order("position").limit(1)
  if (error) throw error

  const stage = data[0]
  if (!stage) {
    throw new ApiError(422, "validation_failed", {
      [stageId ? "stage_id" : "pipeline_id"]: "not_found",
    })
  }
  if (pipelineId && stage.pipeline_id !== pipelineId) {
    throw new ApiError(422, "validation_failed", { stage_id: "not_in_pipeline" })
  }
  return { pipelineId: stage.pipeline_id, stageId: stage.id, kind: stage.kind }
}

function requireLossReason(kind: string, lossReasonId: string | null | undefined) {
  if (kind === "lost" && !lossReasonId)
    throw new ApiError(422, "validation_failed", { loss_reason_id: "required" })
}

async function assertLinks(ctx: ApiContext, input: LeadInput) {
  await assertInOrg(ctx, "contacts", "contact_ids", input.contact_ids)
  await assertInOrg(ctx, "tags", "tag_ids", input.tag_ids)
}

function presentFields(input: LeadInput) {
  return {
    ...(input.title && { title: input.title }),
    ...(input.value !== undefined && { value: input.value }),
    ...(input.currency && { currency: input.currency }),
    ...(input.priority && { priority: input.priority }),
    ...("company_id" in input && { company_id: input.company_id }),
    ...("source_id" in input && { source_id: input.source_id }),
    ...("responsible_id" in input && { responsible_id: input.responsible_id }),
    ...("team_id" in input && { team_id: input.team_id }),
    ...("description" in input && { description: input.description || null }),
    ...("loss_reason_id" in input && { loss_reason_id: input.loss_reason_id }),
  }
}

export async function createLead(ctx: ApiContext, input: LeadInput) {
  if (!input.title) throw new ApiError(422, "validation_failed", { title: "required" })
  const stage = await resolveStage(ctx, input.pipeline_id, input.stage_id)
  requireLossReason(stage.kind, input.loss_reason_id)
  await assertLinks(ctx, input)

  const { data: org, error: orgError } = await ctx.db
    .from("organizations")
    .select("currency")
    .eq("id", ctx.organizationId)
    .single()
  if (orgError) throw orgError

  const id = randomUUID()
  const { error } = await ctx.db.from("leads").insert({
    id,
    organization_id: ctx.organizationId,
    ...presentFields(input),
    title: input.title,
    currency: input.currency ?? org.currency,
    pipeline_id: stage.pipelineId,
    stage_id: stage.stageId,
    custom_fields: await resolveCustomFields(ctx, "lead", input.custom_fields, {}),
    created_by: ctx.actorId,
  })
  if (error) throw error
  await replaceLinks(ctx, "lead_contacts", "lead_id", id, "contact_id", input.contact_ids)
  await replaceLinks(ctx, "lead_tags", "lead_id", id, "tag_id", input.tag_ids)
  return getLead(ctx, id)
}

export async function updateLead(ctx: ApiContext, id: string, input: LeadInput) {
  const current = await getLead(ctx, id)
  await assertLinks(ctx, input)
  let stageFields = {}
  if (input.pipeline_id || input.stage_id) {
    const pipelineId = input.pipeline_id ?? current.pipeline_id
    const stageId =
      input.stage_id ?? (pipelineId === current.pipeline_id ? current.stage_id : undefined)
    const stage = await resolveStage(ctx, pipelineId, stageId)
    requireLossReason(
      stage.kind,
      "loss_reason_id" in input ? input.loss_reason_id : current.loss_reason_id
    )
    stageFields = { pipeline_id: stage.pipelineId, stage_id: stage.stageId }
  }

  const { error } = await ctx.db
    .from("leads")
    .update({
      ...presentFields(input),
      ...stageFields,
      ...(input.custom_fields && {
        custom_fields: await resolveCustomFields(
          ctx,
          "lead",
          input.custom_fields,
          current.custom_fields
        ),
      }),
    })
    .eq("organization_id", ctx.organizationId)
    .eq("id", id)
  if (error) throw error
  await replaceLinks(ctx, "lead_contacts", "lead_id", id, "contact_id", input.contact_ids)
  await replaceLinks(ctx, "lead_tags", "lead_id", id, "tag_id", input.tag_ids)
  return getLead(ctx, id)
}

export async function deleteLead(ctx: ApiContext, id: string) {
  const { data, error } = await ctx.db
    .from("leads")
    .update({ deleted_at: new Date().toISOString() })
    .eq("organization_id", ctx.organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
  if (error) throw error
  if (data.length === 0) notFound()
}

/** Pipeline-urile active cu etapele lor (pentru a alege `pipeline_id` / `stage_id`). */
export async function listPipelines(ctx: ApiContext) {
  const { data, error } = await ctx.db
    .from("pipelines")
    .select("id, name, is_default, stages:pipeline_stages(id, name, kind, position, probability)")
    .eq("organization_id", ctx.organizationId)
    .is("archived_at", null)
    .order("position")
  if (error) throw error
  return data.map((p) => ({ ...p, stages: [...p.stages].sort((a, b) => a.position - b.position) }))
}
