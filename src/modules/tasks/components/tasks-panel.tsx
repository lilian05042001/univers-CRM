"use client"

import { ListChecks, Plus } from "lucide-react"
import { useTranslations } from "next-intl"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import type { RecordRef } from "@/lib/crm/record-ref"

import type { TaskItem } from "../queries"

import { TaskDialog, type TaskDialogContext } from "./task-dialog"
import { TaskRow } from "./task-row"

/** Sarcinile unei înregistrări (fișa lead-ului / contactului / companiei). */
export function TasksPanel({
  recordRef,
  tasks,
  context,
}: {
  recordRef: RecordRef
  tasks: TaskItem[]
  context: TaskDialogContext
}) {
  const t = useTranslations("tasks")

  return (
    <div className="flex flex-col gap-4">
      <TaskDialog
        recordRef={recordRef}
        context={context}
        trigger={
          <Button size="sm" variant="outline" className="w-fit">
            <Plus />
            {t("create")}
          </Button>
        }
      />
      {tasks.length === 0 ? (
        <EmptyState icon={ListChecks} title={t("emptyTitle")} />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} context={context} recordRef={recordRef} />
          ))}
        </ul>
      )}
    </div>
  )
}
