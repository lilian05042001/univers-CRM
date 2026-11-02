"use client"

import { History } from "lucide-react"
import Link from "next/link"
import { useFormatter, useTranslations } from "next-intl"

import { DataTable, type Column } from "@/components/shared/data-table/data-table"
import { Pagination } from "@/components/shared/data-table/pagination"
import { FilterSelect, Toolbar } from "@/components/shared/data-table/toolbar"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import type { NamedOption } from "@/modules/crm-config/types"

import type { RunItem } from "../queries"
import { RUN_STATUSES } from "../schemas"

import { RUN_TONES } from "./run-status"

const ENTITY_HREF: Record<string, (id: string) => string> = {
  lead: (id) => `/leads/${id}`,
  conversation: (id) => `/inbox/${id}`,
  task: () => "/tasks?view=all&responsible=everyone",
}

/** Istoricul execuțiilor: stare, înregistrare, acțiuni executate sau motivul omiterii / erorii. */
export function RunsView({
  rows,
  total,
  page,
  pageSize,
  automations,
}: {
  rows: RunItem[]
  total: number
  page: number
  pageSize: number
  automations: NamedOption[]
}) {
  const t = useTranslations("automations")
  const format = useFormatter()

  function details(run: RunItem) {
    if (run.error) return <span className="text-destructive">{run.error}</span>
    const reason = run.result.reason
    if (typeof reason === "string") return t(`runs.reasons.${reason}`)
    const actions = Array.isArray(run.result.actions)
      ? (run.result.actions as { type: string; skipped?: string }[])
      : []
    return actions
      .map(
        (a) => `${t(`actions.types.${a.type}`)}${a.skipped ? ` (${t("runs.actionSkipped")})` : ""}`
      )
      .join(", ")
  }

  const columns: Column<RunItem>[] = [
    {
      id: "time",
      header: t("runs.time"),
      cell: (r) => (
        <span className="whitespace-nowrap">
          {format.dateTime(new Date(r.startedAt), { dateStyle: "short", timeStyle: "medium" })}
        </span>
      ),
    },
    {
      id: "automation",
      header: t("runs.automation"),
      cell: (r) => (
        <Link href={`/automations/${r.automationId}`} className="font-medium hover:underline">
          {r.automationName}
        </Link>
      ),
    },
    {
      id: "status",
      header: t("runs.statusLabel"),
      cell: (r) => (
        <StatusBadge tone={RUN_TONES[r.status]} dot>
          {t(`runs.status.${r.status}`)}
        </StatusBadge>
      ),
    },
    {
      id: "entity",
      header: t("runs.entity"),
      cell: (r) =>
        r.entityType && r.entityId && ENTITY_HREF[r.entityType] ? (
          <Link href={ENTITY_HREF[r.entityType]!(r.entityId)} className="hover:underline">
            {t(`runs.entities.${r.entityType}`)}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      id: "details",
      header: t("runs.details"),
      cell: (r) => <span className="text-sm">{details(r)}</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <Toolbar filterKeys={["automation", "status"]}>
        <FilterSelect
          param="automation"
          label={t("runs.automation")}
          options={automations.map((a) => ({ value: a.id, label: a.name }))}
        />
        <FilterSelect
          param="status"
          label={t("runs.statusLabel")}
          options={RUN_STATUSES.map((s) => ({ value: s, label: t(`runs.status.${s}`) }))}
        />
      </Toolbar>
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(r) => String(r.id)}
        empty={
          <EmptyState
            icon={History}
            title={t("runs.emptyTitle")}
            description={t("runs.emptyHint")}
          />
        }
      />
      {total > 0 && <Pagination total={total} page={page} pageSize={pageSize} />}
    </div>
  )
}
