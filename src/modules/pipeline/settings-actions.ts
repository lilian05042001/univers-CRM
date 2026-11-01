"use server"

import { z } from "zod"

import { createOrgAction } from "@/lib/actions/action"
import { ok } from "@/lib/actions/result"
import { createClient } from "@/lib/supabase/server"

import { assignmentRuleSchema, pipelineSchema, reorderStagesSchema, stageSchema } from "./schemas"

const perm = "pipelines.manage" as const
const byId = z.object({ id: z.uuid() })

/** Pipeline nou cu etapele minime: „Nou”, „În lucru”, „Câștigat”, „Pierdut”. */
export const savePipeline = createOrgAction(
  { schema: pipelineSchema, permission: perm },
  async ({ id, name }, ctx) => {
    const supabase = await createClient()
    if (id) {
      const { error } = await supabase
        .from("pipelines")
        .update({ name })
        .eq("id", id)
        .eq("organization_id", ctx.organizationId)
      if (error) throw error
      return ok({ id })
    }

    const newId = crypto.randomUUID()
    const { error } = await supabase
      .from("pipelines")
      .insert({ id: newId, organization_id: ctx.organizationId, name, position: 100 })
    if (error) throw error
    const { error: stagesError } = await supabase.from("pipeline_stages").insert(
      [
        { name: "Nou", color: "#64748b", kind: "open" as const, probability: 10 },
        { name: "În lucru", color: "#3b82f6", kind: "open" as const, probability: 50 },
        { name: "Câștigat", color: "#16a34a", kind: "won" as const, probability: 100 },
        { name: "Pierdut", color: "#dc2626", kind: "lost" as const, probability: 0 },
      ].map((s, i) => ({
        ...s,
        organization_id: ctx.organizationId,
        pipeline_id: newId,
        position: i + 1,
      }))
    )
    if (stagesError) throw stagesError
    return ok({ id: newId })
  }
)

export const setDefaultPipeline = createOrgAction(
  { schema: byId, permission: perm },
  async ({ id }, ctx) => {
    const supabase = await createClient()
    // Întâi se scoate vechiul implicit (index unic parțial: un singur pipeline implicit).
    const { error: e1 } = await supabase
      .from("pipelines")
      .update({ is_default: false })
      .eq("organization_id", ctx.organizationId)
      .eq("is_default", true)
    if (e1) throw e1
    const { error } = await supabase
      .from("pipelines")
      .update({ is_default: true })
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)

/** Ștergerea reușește doar dacă pipeline-ul nu are lead-uri (altfel errors.inUse). */
export const deletePipeline = createOrgAction(
  { schema: byId, permission: perm },
  async ({ id }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("pipelines")
      .delete()
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)

export const saveStage = createOrgAction(
  { schema: stageSchema, permission: perm },
  async ({ id, pipelineId, name, color, probability }, ctx) => {
    const supabase = await createClient()
    const fields = { name, color, probability: Number(probability) }
    if (id) {
      const { error } = await supabase
        .from("pipeline_stages")
        .update(fields)
        .eq("id", id)
        .eq("organization_id", ctx.organizationId)
      if (error) throw error
      return ok()
    }

    // Etapă nouă: deschisă, înaintea etapelor finale.
    const { data: stages, error: sError } = await supabase
      .from("pipeline_stages")
      .select("id, kind, position")
      .eq("pipeline_id", pipelineId)
      .order("position")
    if (sError) throw sError
    const open = stages.filter((s) => s.kind === "open")
    const finals = stages.filter((s) => s.kind !== "open")
    const position = (open.at(-1)?.position ?? 0) + 1

    for (const [i, s] of finals.entries()) {
      const { error } = await supabase
        .from("pipeline_stages")
        .update({ position: position + 1 + i })
        .eq("id", s.id)
      if (error) throw error
    }
    const { error } = await supabase.from("pipeline_stages").insert({
      ...fields,
      organization_id: ctx.organizationId,
      pipeline_id: pipelineId,
      kind: "open",
      position,
    })
    if (error) throw error
    return ok()
  }
)

/** Ștergerea reușește doar dacă etapa nu are lead-uri; etapele finale nu se șterg. */
export const deleteStage = createOrgAction(
  { schema: byId, permission: perm },
  async ({ id }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("pipeline_stages")
      .delete()
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .eq("kind", "open")
    if (error) throw error
    return ok()
  }
)

/** Noua ordine a etapelor deschise; etapele finale rămân la sfârșit. */
export const reorderStages = createOrgAction(
  { schema: reorderStagesSchema, permission: perm },
  async ({ pipelineId, stageIds }, ctx) => {
    const supabase = await createClient()
    const { data: stages, error: sError } = await supabase
      .from("pipeline_stages")
      .select("id, kind, position")
      .eq("pipeline_id", pipelineId)
      .eq("organization_id", ctx.organizationId)
      .order("position")
    if (sError) throw sError

    const openIds = stages.filter((s) => s.kind === "open").map((s) => s.id)
    const ordered = [
      ...stageIds.filter((id) => openIds.includes(id)),
      ...openIds.filter((id) => !stageIds.includes(id)),
    ]
    const finals = stages.filter((s) => s.kind !== "open").map((s) => s.id)

    for (const [i, stageId] of [...ordered, ...finals].entries()) {
      const { error } = await supabase
        .from("pipeline_stages")
        .update({ position: i + 1 })
        .eq("id", stageId)
      if (error) throw error
    }
    return ok()
  }
)

export const saveAssignmentRule = createOrgAction(
  { schema: assignmentRuleSchema, permission: perm },
  async ({ pipelineId, strategy, userIds }, ctx) => {
    const supabase = await createClient()
    const { data: existing, error: eError } = await supabase
      .from("assignment_rules")
      .select("id")
      .eq("pipeline_id", pipelineId)
      .maybeSingle()
    if (eError) throw eError

    if (strategy === "none") {
      if (existing) {
        const { error } = await supabase
          .from("assignment_rules")
          .update({ is_active: false })
          .eq("id", existing.id)
        if (error) throw error
      }
      return ok()
    }

    const fields = { strategy, config: { user_ids: userIds, next_index: 0 }, is_active: true }
    const { error } = existing
      ? await supabase.from("assignment_rules").update(fields).eq("id", existing.id)
      : await supabase
          .from("assignment_rules")
          .insert({ ...fields, organization_id: ctx.organizationId, pipeline_id: pipelineId })
    if (error) throw error
    return ok()
  }
)
