import "server-only"

import { createClient } from "@/lib/supabase/server"

import type { ASSIGNMENT_STRATEGIES } from "./schemas"

export type AssignmentRule = {
  pipelineId: string
  strategy: (typeof ASSIGNMENT_STRATEGIES)[number]
  userIds: string[]
}

/** Regulile de atribuire active, pe pipeline (lipsa regulii = „none”). */
export async function listAssignmentRules(organizationId: string): Promise<AssignmentRule[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("assignment_rules")
    .select("pipeline_id, strategy, config")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
  if (error) throw error
  return data.map((r) => {
    const config = (r.config ?? {}) as { user_ids?: string[] }
    return {
      pipelineId: r.pipeline_id,
      strategy: r.strategy as AssignmentRule["strategy"],
      userIds: config.user_ids ?? [],
    }
  })
}
