"use client"

import { ArrowRightLeft, Plus, Tag, Target, Trash2, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { useFormatter, useNow, useTranslations } from "next-intl"
import { useState } from "react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { BulkBar } from "@/components/shared/data-table/bulk-bar"
import { BulkMenu } from "@/components/shared/data-table/bulk-menu"
import { DataTable, type Column } from "@/components/shared/data-table/data-table"
import { ExportButton } from "@/components/shared/data-table/export-button"
import { Pagination } from "@/components/shared/data-table/pagination"
import { FilterSelect, Toolbar } from "@/components/shared/data-table/toolbar"
import { EmptyState } from "@/components/shared/empty-state"
import { StageBadge } from "@/components/shared/stage-badge"
import { StatusBadge } from "@/components/shared/status-badge"
import { TagBadge } from "@/components/shared/tag-badge"
import { Button } from "@/components/ui/button"
import { useListNavigation } from "@/hooks/use-list-navigation"
import { useRouteDialog } from "@/hooks/use-route-dialog"
import { useMoney } from "@/hooks/use-money"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import { nameById } from "@/modules/crm-config/options"
import type { CrmOptions } from "@/modules/crm-config/types"

import { assignLeads, deleteLeads, moveLeads, tagLeads } from "../actions"
import type { LeadRecord, LeadRow } from "../queries"
import { PRIORITIES } from "../schemas"

import { LeadFormDialog } from "./lead-form-dialog"
import { LossReasonDialog } from "./loss-reason-dialog"

type Props = {
  rows: LeadRow[]
  total: number
  page: number
  pageSize: number
  options: CrmOptions
  record: LeadRecord | null
  isNew: boolean
  userId: string
  can: { create: boolean; edit: boolean; delete: boolean; export: boolean; assign: boolean }
}

const priorityTone = { low: "neutral", normal: "info", high: "warning", urgent: "danger" } as const

export function LeadsView({
  rows,
  total,
  page,
  pageSize,
  options,
  record,
  isNew,
  userId,
  can,
}: Props) {
  const t = useTranslations("leads")
  const format = useFormatter()
  const now = useNow()
  const money = useMoney()
  const { searchParams, setParams } = useListNavigation()
  const { run, pending } = useActionRunner()
  const routeDialog = useRouteDialog()
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lostStageId, setLostStageId] = useState<string | null>(null)
  const memberName = nameById(options.members)
  const ids = [...selected]
  const bulkDone = () => setSelected(new Set())

  const pipelineFilter = searchParams.get("pipeline")
  const multiPipeline = options.pipelines.length > 1
  const stageOptions = options.pipelines
    .filter((p) => !pipelineFilter || p.id === pipelineFilter)
    .flatMap((p) =>
      p.stages.map((s) => ({
        value: s.id,
        label: multiPipeline ? `${p.name} · ${s.name}` : s.name,
        kind: s.kind,
      }))
    )

  const columns: Column<LeadRow>[] = [
    {
      id: "title",
      header: t("columns.title"),
      sortKey: "title",
      cell: (l) => (
        <div className="min-w-48">
          <p className="font-medium">{l.title}</p>
          <p className="text-xs text-muted-foreground">
            {[l.contactName, l.companyName].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      ),
    },
    {
      id: "stage",
      header: t("columns.stage"),
      cell: (l) => <StageBadge name={l.stage.name} color={l.stage.color} />,
    },
    {
      id: "value",
      header: t("columns.value"),
      sortKey: "value",
      className: "text-right whitespace-nowrap",
      cell: (l) => money(l.value, l.currency),
    },
    {
      id: "responsible",
      header: t("columns.responsible"),
      cell: (l) => memberName(l.responsibleId) ?? t("unassigned"),
    },
    {
      id: "priority",
      header: t("columns.priority"),
      className: "hidden lg:table-cell",
      cell: (l) => (
        <StatusBadge tone={priorityTone[l.priority]}>{t(`priority.${l.priority}`)}</StatusBadge>
      ),
    },
    {
      id: "next",
      header: t("columns.nextTask"),
      sortKey: "next_task_due_at",
      className: "hidden md:table-cell whitespace-nowrap",
      cell: (l) => {
        if (!l.nextTaskDueAt) return <span className="text-muted-foreground">{t("noTask")}</span>
        const due = new Date(l.nextTaskDueAt)
        const overdue = due < now
        return (
          <span className={overdue ? "font-medium text-destructive" : undefined}>
            {format.relativeTime(due, now)}
          </span>
        )
      },
    },
    {
      id: "tags",
      header: t("columns.tags"),
      className: "hidden xl:table-cell",
      cell: (l) => (
        <div className="flex flex-wrap gap-1">
          {l.tags.map((tag) => (
            <TagBadge key={tag.id} name={tag.name} color={tag.color} />
          ))}
        </div>
      ),
    },
    {
      id: "created",
      header: t("columns.created"),
      sortKey: "created_at",
      className: "hidden xl:table-cell whitespace-nowrap",
      cell: (l) => format.dateTime(new Date(l.createdAt), { dateStyle: "medium" }),
    },
  ]

  function move(stageId: string | null) {
    if (!stageId) return
    const stage = stageOptions.find((s) => s.value === stageId)
    if (stage?.kind === "lost") setLostStageId(stageId)
    else run(() => moveLeads({ ids, stageId }), "leads.bulk.moved", bulkDone)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Toolbar
          filterKeys={[
            "pipeline",
            "stage",
            "status",
            "responsible",
            "team",
            "source",
            "tag",
            "priority",
            "company",
          ]}
        >
          {multiPipeline && (
            <FilterSelect
              param="pipeline"
              label={t("filters.pipeline")}
              options={options.pipelines.map((p) => ({ value: p.id, label: p.name }))}
            />
          )}
          <FilterSelect param="stage" label={t("filters.stage")} options={stageOptions} />
          <FilterSelect
            param="status"
            label={t("filters.status")}
            options={(["open", "won", "lost"] as const).map((s) => ({
              value: s,
              label: t(`status.${s}`),
            }))}
          />
          <FilterSelect
            param="responsible"
            label={t("filters.responsible")}
            options={[
              { value: "me", label: t("filters.me") },
              { value: "none", label: t("unassigned") },
              ...options.members.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
          {options.teams.length > 0 && (
            <FilterSelect
              param="team"
              label={t("filters.team")}
              options={options.teams.map((x) => ({ value: x.id, label: x.name }))}
            />
          )}
          <FilterSelect
            param="source"
            label={t("filters.source")}
            options={options.sources.map((x) => ({ value: x.id, label: x.name }))}
          />
          {options.tags.length > 0 && (
            <FilterSelect
              param="tag"
              label={t("filters.tag")}
              options={options.tags.map((x) => ({ value: x.id, label: x.name }))}
            />
          )}
          <FilterSelect
            param="priority"
            label={t("filters.priority")}
            options={PRIORITIES.map((p) => ({ value: p, label: t(`priority.${p}`) }))}
          />
        </Toolbar>
        {can.export && <ExportButton />}
        {can.create && (
          <Button onClick={() => setParams({ open: "new" }, { resetPage: false })}>
            <Plus />
            {t("create")}
          </Button>
        )}
      </div>

      <BulkBar count={selected.size} onClear={bulkDone}>
        {can.edit && (
          <BulkMenu
            label={t("bulk.move")}
            icon={ArrowRightLeft}
            disabled={pending}
            options={stageOptions.map((s) => ({ value: s.value, label: s.label }))}
            onPick={move}
          />
        )}
        {can.assign && (
          <BulkMenu
            label={t("bulk.assign")}
            icon={UserRound}
            disabled={pending}
            options={[
              { value: null, label: t("unassigned") },
              ...options.members.map((m) => ({ value: m.id, label: m.name })),
            ]}
            onPick={(responsibleId) =>
              run(() => assignLeads({ ids, responsibleId }), "leads.bulk.assigned", bulkDone)
            }
          />
        )}
        {can.edit && options.tags.length > 0 && (
          <BulkMenu
            label={t("bulk.tag")}
            icon={Tag}
            disabled={pending}
            options={options.tags.map((tag) => ({ value: tag.id, label: tag.name }))}
            onPick={(tagId) =>
              tagId && run(() => tagLeads({ ids, tagId }), "leads.bulk.tagged", bulkDone)
            }
          />
        )}
        {can.delete && (
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm" disabled={pending}>
                <Trash2 />
                {t("bulk.delete")}
              </Button>
            }
            title={t("bulk.deleteTitle")}
            description={t("bulk.deleteDescription", { count: selected.size })}
            confirmLabel={t("bulk.delete")}
            onConfirm={() => run(() => deleteLeads({ ids }), "leads.bulk.deleted", bulkDone)}
          />
        )}
      </BulkBar>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(l) => l.id}
        selection={
          can.edit || can.delete || can.assign ? { selected, onChange: setSelected } : undefined
        }
        onRowClick={(l) => router.push(`/leads/${l.id}`)}
        empty={
          <EmptyState icon={Target} title={t("emptyTitle")} description={t("emptyDescription")} />
        }
      />
      {total > 0 && <Pagination total={total} page={page} pageSize={pageSize} />}

      {lostStageId && (
        <LossReasonDialog
          reasons={options.lossReasons}
          onCancel={() => setLostStageId(null)}
          onConfirm={(lossReasonId) => {
            const stageId = lostStageId
            setLostStageId(null)
            run(() => moveLeads({ ids, stageId, lossReasonId }), "leads.bulk.moved", bulkDone)
          }}
        />
      )}
      {routeDialog.openParam && (isNew || record) && (
        <LeadFormDialog
          key={record?.id ?? "new"}
          record={record}
          options={options}
          canAssign={can.assign}
          userId={userId}
          onClose={routeDialog.close}
        />
      )}
    </div>
  )
}
