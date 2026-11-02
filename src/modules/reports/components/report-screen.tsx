import { Download, Lock } from "lucide-react"
import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { cn } from "cn"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { SearchParams } from "@/lib/list-params"

import { canViewReports, loadReportContext } from "../context"
import { loadReport } from "../queries"
import { REPORT_KEYS, type ReportKey } from "../types"

import { ReportChart } from "./report-chart"
import { ReportFilters, type FilterKey } from "./report-filters"
import { ReportTable } from "./report-table"

const FILTERS: Record<ReportKey, FilterKey[]> = {
  leads: ["pipeline", "team", "responsible", "source"],
  sales: ["pipeline", "team", "responsible", "source"],
  funnel: ["pipeline", "team", "responsible", "source"],
  team: ["pipeline", "team", "responsible", "source"],
  sources: ["pipeline", "team", "responsible"],
  activities: ["responsible"],
  losses: ["pipeline", "team", "responsible", "source"],
}

const toQuery = (params: SearchParams) => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) query.set(key, value)
  }
  return query.toString()
}

/** Un raport: navigare între rapoarte, filtre, grafic, tabel, export CSV. */
export async function ReportScreen({
  reportKey,
  searchParams,
}: {
  reportKey: ReportKey
  searchParams: SearchParams
}) {
  const t = await getTranslations("reports")
  const { ctx, options, period, filters, reportCtx, defaultPipelineId } =
    await loadReportContext(searchParams)
  if (!canViewReports(ctx)) {
    return <EmptyState icon={Lock} title={t("noAccessTitle")} description={t("noAccessHint")} />
  }

  const data = await loadReport(reportKey, reportCtx, period, filters, defaultPipelineId)
  const query = toQuery(searchParams)

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t("navLabel")} className="flex flex-wrap gap-1 border-b pb-2">
        {REPORT_KEYS.map((key) => (
          <Link
            key={key}
            href={`/reports/${key}${query ? `?${query}` : ""}`}
            aria-current={key === reportKey ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              key === reportKey && "bg-muted font-medium text-foreground"
            )}
          >
            {t(`list.${key}.title`)}
          </Link>
        ))}
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <ReportFilters
          period={period}
          show={FILTERS[reportKey]}
          pipelineAll={reportKey !== "funnel"}
          options={{
            pipeline: options.pipelines,
            team: options.teams,
            responsible: options.members,
            source: options.sources,
          }}
        />
        {ctx.can("data.export") && (
          <Button asChild variant="outline">
            <a href={`/reports/${reportKey}/export${query ? `?${query}` : ""}`} download>
              <Download />
              {t("export")}
            </a>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t(`list.${reportKey}.title`)}</CardTitle>
          <CardDescription>{t(`list.${reportKey}.description`)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {data.chart && data.rows.length > 0 && (
            <ReportChart
              spec={data.chart}
              rows={data.rows}
              columns={data.columns}
              currency={data.currency}
            />
          )}
          <ReportTable columns={data.columns} rows={data.rows} currency={data.currency} />
          <p className="text-xs text-muted-foreground">
            {t("currencyNote", { currency: data.currency })}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
