import "server-only"

import { getOrgContext, type OrgContext } from "@/lib/auth/session"
import type { SearchParams } from "@/lib/list-params"
import { getCrmOptions } from "@/modules/crm-config/queries"

import { resolvePeriod } from "./period"
import type { ReportFilters } from "./types"

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""

/** Rapoartele echipei / companiei; dashboard-ul e disponibil tuturor (cifrele urmează RLS). */
export const canViewReports = (ctx: OrgContext) =>
  ctx.can("reports.view.all") || ctx.can("reports.view.team")

/** Perioada și filtrele din URL, validate față de opțiunile organizației. */
export async function loadReportContext(searchParams: SearchParams) {
  const ctx = await getOrgContext()
  const options = await getCrmOptions(ctx.organizationId)
  const period = resolvePeriod(
    {
      period: first(searchParams.period),
      from: first(searchParams.from),
      to: first(searchParams.to),
    },
    ctx.membership.organization.timezone
  )
  const pick = (key: string, ids: { id: string }[]) => {
    const value = first(searchParams[key])
    return ids.some((x) => x.id === value) ? value : null
  }
  const filters: ReportFilters = {
    pipelineId: pick("pipeline", options.pipelines),
    responsibleId: pick("responsible", options.members),
    teamId: pick("team", options.teams),
    sourceId: pick("source", options.sources),
  }
  return {
    ctx,
    options,
    period,
    filters,
    reportCtx: {
      organizationId: ctx.organizationId,
      currency: ctx.membership.organization.currency,
    },
    defaultPipelineId:
      (options.pipelines.find((p) => p.isDefault) ?? options.pipelines[0])?.id ?? null,
  }
}
