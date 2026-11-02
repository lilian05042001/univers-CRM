"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportChart } from "@/modules/reports/components/report-chart"
import type { ReportData, ReportKey } from "@/modules/reports/types"

/** Un grafic din dashboard, cu link spre raportul complet (tabel, filtre, export). */
export function DashboardChart({
  title,
  report,
  data,
  query,
}: {
  title: string
  report: ReportKey
  data: ReportData
  query: string
}) {
  const t = useTranslations("dashboard")
  const hasData = data.rows.some((r) => data.chart!.series.some((s) => Number(r[s]) > 0))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardAction>
          <Link
            href={`/reports/${report}${query ? `?${query}` : ""}`}
            className="text-sm text-primary hover:underline"
          >
            {t("details")}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ReportChart
            spec={data.chart!}
            rows={data.rows}
            columns={data.columns}
            currency={data.currency}
            className={data.chart!.horizontal ? undefined : "aspect-auto h-60 w-full"}
          />
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("noData")}</p>
        )}
      </CardContent>
    </Card>
  )
}
