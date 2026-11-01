"use client"

import { ListChecks, Plus } from "lucide-react"
import { useTranslations } from "next-intl"

import { Pagination } from "@/components/shared/data-table/pagination"
import { FilterSelect } from "@/components/shared/data-table/toolbar"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useListNavigation } from "@/hooks/use-list-navigation"

import type { TaskItem } from "../queries"
import { TASK_VIEWS, type TaskView } from "../schemas"

import { TaskDialog, type TaskDialogContext } from "./task-dialog"
import { TaskRow } from "./task-row"

type Props = {
  rows: TaskItem[]
  total: number
  page: number
  pageSize: number
  view: TaskView
  counts: { today: number; overdue: number; upcoming: number }
  context: TaskDialogContext
}

export function TasksView({ rows, total, page, pageSize, view, counts, context }: Props) {
  const t = useTranslations("tasks")
  const { setParams } = useListNavigation()
  const count = (v: TaskView) =>
    v === "today" || v === "overdue" || v === "upcoming" ? counts[v] : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setParams({ view: v })}>
          <TabsList className="flex-wrap">
            {TASK_VIEWS.map((v) => (
              <TabsTrigger
                key={v}
                value={v}
                className={v === "overdue" && counts.overdue > 0 ? "text-destructive" : ""}
              >
                {t(`views.${v}`)}
                {count(v) !== null && <span className="ml-1 tabular-nums">({count(v)})</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <TaskDialog
          recordRef={null}
          context={context}
          trigger={
            <Button>
              <Plus />
              {t("create")}
            </Button>
          }
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <FilterSelect
          param="responsible"
          label={t("filters.responsible")}
          allLabel={t("filters.mine")}
          options={[
            { value: "everyone", label: t("filters.everyone") },
            { value: "none", label: t("filters.unassigned") },
            ...context.members.map((m) => ({ value: m.id, label: m.name })),
          ]}
        />
        <FilterSelect
          param="type"
          label={t("filters.type")}
          options={context.types.map((x) => ({ value: x.id, label: x.name }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ListChecks} title={t(`empty.${view}`)} />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {rows.map((task) => (
            <TaskRow key={task.id} task={task} context={context} recordRef={null} showRecord />
          ))}
        </ul>
      )}
      {total > 0 && <Pagination total={total} page={page} pageSize={pageSize} />}
    </div>
  )
}
