import { getTranslations } from "next-intl/server"

import { csvResponse } from "@/lib/csv"

import { canViewReports, loadReportContext } from "@/modules/reports/context"
import { toCsv } from "@/modules/reports/csv"
import { loadReport } from "@/modules/reports/queries"
import { REPORT_KEYS, type ReportKey } from "@/modules/reports/types"

/** Exportul CSV al unui raport, cu aceleași filtre ca pagina (necesită data.export). */
export async function GET(request: Request, ctx: RouteContext<"/reports/[report]/export">) {
  const { report } = await ctx.params
  if (!(REPORT_KEYS as readonly string[]).includes(report)) {
    return new Response("Not found", { status: 404 })
  }
  const searchParams = Object.fromEntries(new URL(request.url).searchParams)
  const {
    ctx: org,
    period,
    filters,
    reportCtx,
    defaultPipelineId,
  } = await loadReportContext(searchParams)
  if (!canViewReports(org) || !org.can("data.export")) {
    return new Response("Forbidden", { status: 403 })
  }

  const t = await getTranslations("reports")
  const data = await loadReport(report as ReportKey, reportCtx, period, filters, defaultPipelineId)
  const csv = toCsv(data.columns, data.rows, (c) => t(`columns.${c.key}`), t("unassigned"))
  const fileName = `raport-${report}-${period.fromDate}_${period.toDate}.csv`

  return csvResponse(csv, fileName)
}
