import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { moduleMetadata } from "@/lib/i18n/metadata"
import { DashboardChart } from "@/modules/dashboard/components/dashboard-chart"
import { KpiTiles } from "@/modules/dashboard/components/kpi-tiles"
import { RecentActivity } from "@/modules/dashboard/components/recent-activity"
import { ReportFilters } from "@/modules/reports/components/report-filters"
import { loadReportContext } from "@/modules/reports/context"
import { getKpis, listRecentActivity, loadReport } from "@/modules/reports/queries"

export const generateMetadata = moduleMetadata("dashboard")

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const t = useTranslations()

  return (
    <>
      <PageHeader title={t("nav.dashboard")} description={t("dashboard.description")} />
      <Suspense fallback={<PageSkeleton />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Dashboard({ searchParams }: Pick<PageProps<"/dashboard">, "searchParams">) {
  const query = await searchParams
  const t = await getTranslations("dashboard")
  const { ctx, options, period, filters, reportCtx, defaultPipelineId } =
    await loadReportContext(query)
  const load = (key: Parameters<typeof loadReport>[0]) =>
    loadReport(key, reportCtx, period, filters, defaultPipelineId)

  const [kpis, sales, leads, funnel, team, sources, activity] = await Promise.all([
    getKpis(reportCtx, period, filters),
    load("sales"),
    load("leads"),
    load("funnel"),
    load("team"),
    load("sources"),
    listRecentActivity(ctx.organizationId),
  ])
  const qs = new URLSearchParams(
    Object.entries(query).filter((e): e is [string, string] => typeof e[1] === "string")
  ).toString()

  return (
    <div className="flex flex-col gap-6">
      <ReportFilters
        period={period}
        show={["pipeline", "team", "responsible"]}
        options={{
          pipeline: options.pipelines,
          team: options.teams,
          responsible: options.members,
          source: [],
        }}
      />
      <KpiTiles kpis={kpis} currency={reportCtx.currency} />
      <div className="grid gap-6 xl:grid-cols-2">
        <DashboardChart title={t("charts.sales")} report="sales" data={sales} query={qs} />
        <DashboardChart title={t("charts.leads")} report="leads" data={leads} query={qs} />
        <DashboardChart title={t("charts.funnel")} report="funnel" data={funnel} query={qs} />
        <DashboardChart title={t("charts.team")} report="team" data={team} query={qs} />
        <DashboardChart title={t("charts.sources")} report="sources" data={sources} query={qs} />
        <Card>
          <CardHeader>
            <CardTitle>{t("recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            <RecentActivity items={activity} members={options.members} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
