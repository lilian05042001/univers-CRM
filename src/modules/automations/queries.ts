import "server-only"

import type { TriggerType } from "@/lib/automation-engine/types"
import { pageRange } from "@/lib/list-params"
import { createClient } from "@/lib/supabase/server"

import type { AutomationRecord } from "./mapping"
import type { RunStatus } from "./schemas"

const COLUMNS =
  "id, name, description, trigger_type, trigger_config, conditions, actions, pipeline_id, is_active"

export type AutomationListItem = AutomationRecord & {
  lastRun: { status: RunStatus; startedAt: string } | null
  runs30d: number
  failures30d: number
}

export async function listAutomations(organizationId: string): Promise<AutomationListItem[]> {
  const supabase = await createClient()
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const [automations, runs] = await Promise.all([
    supabase
      .from("automations")
      .select(COLUMNS)
      .eq("organization_id", organizationId)
      .order("created_at"),
    supabase
      .from("automation_runs")
      .select("automation_id, status, started_at")
      .eq("organization_id", organizationId)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(5000),
  ])
  if (automations.error) throw automations.error
  if (runs.error) throw runs.error

  return automations.data.map((a) => {
    const own = runs.data.filter((r) => r.automation_id === a.id)
    return {
      ...(a as unknown as AutomationRecord),
      lastRun: own[0] ? { status: own[0].status as RunStatus, startedAt: own[0].started_at } : null,
      runs30d: own.filter((r) => r.status !== "skipped").length,
      failures30d: own.filter((r) => r.status === "failed").length,
    }
  })
}

export async function getAutomation(id: string): Promise<AutomationRecord | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("automations")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  return data as unknown as AutomationRecord | null
}

export type RunItem = {
  id: number
  automationId: string
  automationName: string
  triggerType: TriggerType
  status: RunStatus
  entityType: string | null
  entityId: string | null
  startedAt: string
  error: string | null
  result: Record<string, unknown>
}

export async function listRuns(
  organizationId: string,
  filters: { automationId: string; status: string; page: number; pageSize: number }
): Promise<{ rows: RunItem[]; total: number }> {
  const supabase = await createClient()
  const { from, to } = pageRange(filters)
  let query = supabase
    .from("automation_runs")
    .select(
      "id, automation_id, status, entity_type, entity_id, started_at, error, result, automation:automations!inner(name, trigger_type)",
      { count: "exact" }
    )
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to)
  if (filters.automationId) query = query.eq("automation_id", filters.automationId)
  if (filters.status) query = query.eq("status", filters.status)

  const { data, error, count } = await query
  if (error) throw error
  return {
    total: count ?? 0,
    rows: data.map((r) => ({
      id: r.id,
      automationId: r.automation_id,
      automationName: r.automation.name,
      triggerType: r.automation.trigger_type as TriggerType,
      status: r.status as RunStatus,
      entityType: r.entity_type,
      entityId: r.entity_id,
      startedAt: r.started_at,
      error: r.error,
      result: (r.result ?? {}) as Record<string, unknown>,
    })),
  }
}
