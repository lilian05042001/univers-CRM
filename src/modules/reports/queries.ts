import "server-only"

import { createClient } from "@/lib/supabase/server"
import type { ActivityItem } from "@/modules/activity/queries"

import type { ResolvedPeriod } from "./period"
import type { ReportData, ReportFilters, ReportKey, ReportRow } from "./types"

type Ctx = { organizationId: string; currency: string }

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v))

function base(ctx: Ctx, period: ResolvedPeriod) {
  return {
    p_org: ctx.organizationId,
    p_from: period.start.toISOString(),
    p_to: period.end.toISOString(),
  }
}

const opt = (v: string | null) => v ?? undefined

export async function getKpis(ctx: Ctx, period: ResolvedPeriod, f: ReportFilters) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc("report_kpis", {
      ...base(ctx, period),
      p_pipeline: opt(f.pipelineId),
      p_responsible: opt(f.responsibleId),
      p_team: opt(f.teamId),
      p_source: opt(f.sourceId),
    })
    .single()
  if (error) throw error
  return {
    newLeads: data.new_leads,
    activeLeads: data.active_leads,
    activeValue: num(data.active_value),
    wonCount: data.won_count,
    wonAmount: num(data.won_amount),
    lostCount: data.lost_count,
    winRate: data.win_rate === null ? null : num(data.win_rate),
    avgCycleDays: data.avg_cycle_days === null ? null : num(data.avg_cycle_days),
    tasksOverdue: data.tasks_overdue,
    tasksToday: data.tasks_today,
  }
}
export type Kpis = Awaited<ReturnType<typeof getKpis>>

async function timeseries(ctx: Ctx, period: ResolvedPeriod, f: ReportFilters) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("report_timeseries", {
    ...base(ctx, period),
    p_bucket: period.bucket,
    p_pipeline: opt(f.pipelineId),
    p_responsible: opt(f.responsibleId),
    p_team: opt(f.teamId),
    p_source: opt(f.sourceId),
  })
  if (error) throw error
  return data.map((r) => ({
    bucket: r.bucket,
    new_leads: r.new_leads,
    won_count: r.won_count,
    won_amount: num(r.won_amount),
    lost_count: r.lost_count,
  }))
}

async function funnel(ctx: Ctx, period: ResolvedPeriod, f: ReportFilters, pipelineId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("report_funnel", {
    ...base(ctx, period),
    p_pipeline: pipelineId,
    p_responsible: opt(f.responsibleId),
    p_team: opt(f.teamId),
    p_source: opt(f.sourceId),
  })
  if (error) throw error
  // Conversia: din prima etapă (intrări totale) și față de etapa deschisă anterioară.
  const first = data[0]?.reached ?? 0
  let previous: number | null = null
  return data.map((s) => {
    const row: ReportRow = {
      stage: s.name,
      kind: s.kind,
      reached: s.reached,
      from_start: first ? Math.round((1000 * s.reached) / first) / 10 : null,
      // Pierdutul nu urmează etapei anterioare: conversia relativă nu are sens.
      from_previous:
        previous && s.kind !== "lost" ? Math.round((1000 * s.reached) / previous) / 10 : null,
      current_count: s.current_count,
      current_value: num(s.current_value),
    }
    if (s.kind === "open") previous = s.reached
    return row
  })
}

/**
 * Datele unui raport (tabel + grafic). Aceeași sursă pentru pagină, dashboard și export CSV.
 * Funcțiile SQL sunt security invoker: cifrele respectă vizibilitatea rolului.
 */
export async function loadReport(
  key: ReportKey,
  ctx: Ctx,
  period: ResolvedPeriod,
  f: ReportFilters,
  defaultPipelineId: string | null
): Promise<ReportData> {
  const supabase = await createClient()
  const bucketKind =
    period.bucket === "month" ? "month" : period.bucket === "week" ? "week" : "date"
  const common = { currency: ctx.currency }

  switch (key) {
    case "leads":
      return {
        ...common,
        columns: [
          { key: "bucket", kind: bucketKind },
          { key: "new_leads", kind: "int" },
          { key: "won_count", kind: "int" },
          { key: "lost_count", kind: "int" },
        ],
        rows: await timeseries(ctx, period, f),
        chart: {
          type: "line",
          x: "bucket",
          series: ["new_leads", "won_count", "lost_count"],
          // Câștigate = aqua, pierdute = portocaliu (nu verde pentru pierderi).
          colors: [1, 3, 2],
          valueKind: "int",
        },
      }
    case "sales":
      return {
        ...common,
        columns: [
          { key: "bucket", kind: bucketKind },
          { key: "won_count", kind: "int" },
          { key: "won_amount", kind: "money" },
        ],
        rows: await timeseries(ctx, period, f),
        chart: { type: "bar", x: "bucket", series: ["won_amount"], valueKind: "money" },
      }
    case "funnel": {
      const pipelineId = f.pipelineId ?? defaultPipelineId
      return {
        ...common,
        columns: [
          { key: "stage", kind: "text" },
          { key: "reached", kind: "int" },
          { key: "from_start", kind: "percent" },
          { key: "from_previous", kind: "percent" },
          { key: "current_count", kind: "int" },
          { key: "current_value", kind: "money" },
        ],
        rows: pipelineId ? await funnel(ctx, period, f, pipelineId) : [],
        chart: { type: "bar", x: "stage", series: ["reached"], horizontal: true, valueKind: "int" },
      }
    }
    case "team": {
      const { data, error } = await supabase.rpc("report_by_responsible", {
        ...base(ctx, period),
        p_pipeline: opt(f.pipelineId),
        p_team: opt(f.teamId),
        p_source: opt(f.sourceId),
      })
      if (error) throw error
      return {
        ...common,
        columns: [
          { key: "name", kind: "text" },
          { key: "new_leads", kind: "int" },
          { key: "open_leads", kind: "int" },
          { key: "open_value", kind: "money" },
          { key: "won_count", kind: "int" },
          { key: "won_amount", kind: "money" },
          { key: "lost_count", kind: "int" },
          { key: "tasks_done", kind: "int" },
          { key: "tasks_overdue", kind: "int" },
        ],
        rows: data
          .filter((r) => r.user_id || r.new_leads || r.open_leads || r.won_count || r.lost_count)
          .filter((r) => !f.responsibleId || r.user_id === f.responsibleId)
          .map((r) => ({
            ...r,
            name: r.name,
            open_value: num(r.open_value),
            won_amount: num(r.won_amount),
          }))
          .sort((a, b) => b.won_amount - a.won_amount || b.open_leads - a.open_leads),
        chart: {
          type: "bar",
          x: "name",
          series: ["won_amount"],
          horizontal: true,
          valueKind: "money",
        },
      }
    }
    case "sources": {
      const { data, error } = await supabase.rpc("report_by_source", {
        ...base(ctx, period),
        p_pipeline: opt(f.pipelineId),
        p_responsible: opt(f.responsibleId),
        p_team: opt(f.teamId),
      })
      if (error) throw error
      return {
        ...common,
        columns: [
          { key: "name", kind: "text" },
          { key: "new_leads", kind: "int" },
          { key: "won_count", kind: "int" },
          { key: "won_amount", kind: "money" },
        ],
        rows: data
          .filter((r) => r.source_id || r.new_leads || r.won_count)
          .map((r) => ({ ...r, won_amount: num(r.won_amount) })),
        chart: {
          type: "bar",
          x: "name",
          series: ["new_leads"],
          horizontal: true,
          valueKind: "int",
        },
      }
    }
    case "activities": {
      const { data, error } = await supabase.rpc("report_activities", {
        ...base(ctx, period),
        p_responsible: opt(f.responsibleId),
      })
      if (error) throw error
      return {
        ...common,
        columns: [
          { key: "name", kind: "text" },
          { key: "planned", kind: "int" },
          { key: "done", kind: "int" },
          { key: "overdue", kind: "int" },
        ],
        rows: data,
        chart: {
          type: "bar",
          x: "name",
          series: ["done", "overdue"],
          horizontal: true,
          valueKind: "int",
        },
      }
    }
    case "losses": {
      const { data, error } = await supabase.rpc("report_loss_reasons", {
        ...base(ctx, period),
        p_pipeline: opt(f.pipelineId),
        p_responsible: opt(f.responsibleId),
        p_team: opt(f.teamId),
        p_source: opt(f.sourceId),
      })
      if (error) throw error
      return {
        ...common,
        columns: [
          { key: "name", kind: "text" },
          { key: "lost_count", kind: "int" },
          { key: "lost_value", kind: "money" },
        ],
        rows: data
          .filter((r) => r.reason_id || r.lost_count)
          .map((r) => ({ ...r, lost_value: num(r.lost_value) })),
        chart: {
          type: "bar",
          x: "name",
          series: ["lost_count"],
          horizontal: true,
          valueKind: "int",
        },
      }
    }
  }
}

export type RecentActivity = ActivityItem & { contactId: string | null }

/** Fluxul de activitate recentă (cronologia vizibilă utilizatorului, RLS). */
export async function listRecentActivity(organizationId: string, limit = 15) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("activities")
    .select("id, type, actor_id, payload, occurred_at, lead_id, contact_id")
    .eq("organization_id", organizationId)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit)
  if (error) throw error
  return data.map((a): RecentActivity => ({
    id: a.id,
    type: a.type,
    actorId: a.actor_id,
    payload: (a.payload ?? {}) as ActivityItem["payload"],
    occurredAt: a.occurred_at,
    leadId: a.lead_id,
    contactId: a.contact_id,
  }))
}
