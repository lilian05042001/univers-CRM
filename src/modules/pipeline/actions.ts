"use server"

import { createOrgAction } from "@/lib/actions/action"
import { fail, ok } from "@/lib/actions/result"
import { createClient } from "@/lib/supabase/server"
import { getCrmOptions } from "@/modules/crm-config/queries"
import { listStageLeads } from "@/modules/leads/queries"

import { loadStageSchema, moveCardSchema } from "./schemas"

/**
 * Mută un card pe tablă: etapă (eventual alt pipeline) + poziție între vecini.
 * Poziția e la mijlocul vecinilor, fără renumerotarea coloanei.
 */
export const moveCard = createOrgAction(
  { schema: moveCardSchema, permission: "leads.edit" },
  async ({ leadId, stageId, beforeId, afterId, lossReasonId }, ctx) => {
    const options = await getCrmOptions(ctx.organizationId)
    const pipeline = options.pipelines.find((p) => p.stages.some((s) => s.id === stageId))
    const stage = pipeline?.stages.find((s) => s.id === stageId)
    if (!pipeline || !stage) return fail("errors.validation")
    if (stage.kind === "lost" && !lossReasonId) return fail("errors.lossReasonRequired")

    const supabase = await createClient()
    const neighbourIds = [beforeId, afterId].filter((id): id is string => Boolean(id))
    const { data: neighbours, error: nError } = neighbourIds.length
      ? await supabase.from("leads").select("id, position").in("id", neighbourIds)
      : { data: [], error: null }
    if (nError) throw nError

    const before = neighbours.find((n) => n.id === beforeId)?.position
    const after = neighbours.find((n) => n.id === afterId)?.position
    const position =
      before !== undefined && after !== undefined
        ? (before + after) / 2
        : before !== undefined
          ? before + 1
          : after !== undefined
            ? after - 1
            : 0

    const { error } = await supabase
      .from("leads")
      .update({
        pipeline_id: pipeline.id,
        stage_id: stageId,
        position,
        ...(stage.kind === "lost" && { loss_reason_id: lossReasonId }),
      })
      .eq("id", leadId)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)

/** Următoarele carduri ale unei coloane („Încarcă mai multe”). */
export const loadStageLeads = createOrgAction(
  { schema: loadStageSchema },
  async ({ stageId, offset, filters }, ctx) => {
    const get = (key: string) => (filters as Record<string, string>)[key] ?? ""
    return ok(await listStageLeads(ctx.organizationId, ctx.user.id, stageId, get, offset))
  }
)
