"use client"

import { CalendarDays, Plus } from "lucide-react"
import { useTranslations } from "next-intl"

import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { utcToZonedInput, zonedInputToUtc } from "@/lib/utils/timezone"
import { TaskDialog, type TaskDialogContext } from "@/modules/tasks/components/task-dialog"
import { TaskRow } from "@/modules/tasks/components/task-row"
import type { TaskItem } from "@/modules/tasks/queries"

/** Vederea pe zi: sarcinile grupate pe ore, cu adăugare rapidă la o oră. */
export function DayAgenda({
  date,
  tasks,
  context,
}: {
  date: string
  tasks: TaskItem[]
  context: TaskDialogContext
}) {
  const t = useTranslations("calendar")
  const byHour = new Map<number, TaskItem[]>()
  for (const task of tasks) {
    const hour = Number(utcToZonedInput(task.dueAt, context.timeZone).slice(11, 13))
    byHour.set(hour, [...(byHour.get(hour) ?? []), task])
  }
  const hours = Array.from({ length: 24 }, (_, h) => h).filter(
    (h) => (h >= 7 && h <= 20) || byHour.has(h)
  )

  if (tasks.length === 0 && hours.length === 0) {
    return <EmptyState icon={CalendarDays} title={t("emptyDay")} />
  }

  return (
    <div className="divide-y rounded-lg border bg-card">
      {hours.map((hour) => {
        const label = `${String(hour).padStart(2, "0")}:00`
        return (
          <div key={hour} className="group flex gap-3 px-3 py-2">
            <span className="w-12 shrink-0 pt-2.5 text-xs text-muted-foreground tabular-nums">
              {label}
            </span>
            <ul className="flex-1">
              {(byHour.get(hour) ?? []).map((task) => (
                <TaskRow key={task.id} task={task} context={context} recordRef={null} showRecord />
              ))}
            </ul>
            <TaskDialog
              recordRef={null}
              context={context}
              defaultDue={zonedInputToUtc(`${date}T${label}`, context.timeZone)}
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={t("addAt", { time: label })}
                >
                  <Plus />
                </Button>
              }
            />
          </div>
        )
      })}
    </div>
  )
}
