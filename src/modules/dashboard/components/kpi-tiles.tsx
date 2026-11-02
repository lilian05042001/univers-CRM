"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"

import { Card, CardContent } from "@/components/ui/card"
import type { Kpis } from "@/modules/reports/queries"
import { useReportFormat } from "@/modules/reports/components/use-report-format"

type Tile = { key: string; value: string; detail?: string; href?: string; tone?: "danger" }

/** Indicatorii principali: un număr mare per card, cu o explicație scurtă dedesubt. */
export function KpiTiles({ kpis, currency }: { kpis: Kpis; currency: string }) {
  const t = useTranslations("dashboard.kpis")
  const fmt = useReportFormat(currency)

  const tiles: Tile[] = [
    { key: "newLeads", value: fmt(kpis.newLeads, "int"), href: "/leads?sort=created_at" },
    { key: "activeLeads", value: fmt(kpis.activeLeads, "int"), href: "/pipeline" },
    {
      key: "wonAmount",
      value: fmt(kpis.wonAmount, "money"),
      detail: t("wonCount", { count: kpis.wonCount }),
    },
    {
      key: "winRate",
      value: kpis.winRate === null ? "—" : fmt(kpis.winRate, "percent"),
      detail: t("closed", { won: kpis.wonCount, lost: kpis.lostCount }),
    },
    {
      key: "cycle",
      value: kpis.avgCycleDays === null ? "—" : fmt(kpis.avgCycleDays, "days"),
    },
    { key: "pipelineValue", value: fmt(kpis.activeValue, "money"), detail: t("pipelineHint") },
    {
      key: "tasksOverdue",
      value: fmt(kpis.tasksOverdue, "int"),
      href: "/tasks?view=overdue",
      tone: kpis.tasksOverdue > 0 ? "danger" : undefined,
    },
    { key: "tasksToday", value: fmt(kpis.tasksToday, "int"), href: "/tasks?view=today" },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => {
        const body = (
          <Card className="h-full py-4 transition-colors hover:bg-muted/40" data-kpi={tile.key}>
            <CardContent className="flex flex-col gap-1 px-4">
              <span className="text-sm text-muted-foreground">{t(tile.key)}</span>
              <span
                className={`text-2xl font-semibold tabular-nums ${tile.tone === "danger" ? "text-destructive" : ""}`}
              >
                {tile.value}
              </span>
              {tile.detail && <span className="text-xs text-muted-foreground">{tile.detail}</span>}
            </CardContent>
          </Card>
        )
        return tile.href ? (
          <Link key={tile.key} href={tile.href} className="rounded-xl">
            {body}
          </Link>
        ) : (
          <div key={tile.key}>{body}</div>
        )
      })}
    </div>
  )
}
