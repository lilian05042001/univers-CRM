"use client"

import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { useFormatter, useNow, useTranslations } from "next-intl"
import { useId, useRef } from "react"

import { FilterSelect } from "@/components/shared/data-table/toolbar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useListNavigation } from "@/hooks/use-list-navigation"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import { addDays, utcToZonedInput } from "@/lib/utils/timezone"
import { rescheduleTask } from "@/modules/tasks/actions"
import { TaskDialog, type TaskDialogContext } from "@/modules/tasks/components/task-dialog"
import type { TaskItem } from "@/modules/tasks/queries"

import { CALENDAR_VIEWS, dateValue, shiftDate, type CalendarView as View } from "../utils"

import { CalendarGrid } from "./calendar-grid"
import { DayAgenda } from "./day-agenda"

type Props = {
  view: View
  date: string
  from: string
  days: number
  today: string
  tasks: TaskItem[]
  context: TaskDialogContext
}

export function CalendarView({ view, date, from, days, today, tasks, context }: Props) {
  const t = useTranslations("calendar")
  const tTasks = useTranslations("tasks")
  const format = useFormatter()
  const now = useNow()
  const { setParams } = useListNavigation()
  const { run } = useActionRunner()
  const dndId = useId()
  const dragging = useRef(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const local = (task: TaskItem) => utcToZonedInput(task.dueAt, context.timeZone)
  const byDate = new Map<string, TaskItem[]>()
  for (const task of tasks) {
    const d = local(task).slice(0, 10)
    byDate.set(d, [...(byDate.get(d) ?? []), task])
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setTimeout(() => (dragging.current = false), 0)
    const task = tasks.find((x) => x.id === active.id)
    const target = over ? String(over.id) : null
    if (!task || !target || local(task).slice(0, 10) === target) return
    run(
      () => rescheduleTask({ id: task.id, dueAt: `${target}T${local(task).slice(11)}` }),
      "calendar.rescheduled"
    )
  }

  const title =
    view === "month"
      ? format.dateTime(dateValue(date), { month: "long", year: "numeric", timeZone: "UTC" })
      : view === "week"
        ? `${format.dateTime(dateValue(from), { day: "numeric", month: "short", timeZone: "UTC" })} – ${format.dateTime(
            dateValue(addDays(from, 6)),
            { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
          )}`
        : format.dateTime(dateValue(date), { dateStyle: "full", timeZone: "UTC" })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("previous")}
          onClick={() => setParams({ date: shiftDate(view, date, -1) })}
        >
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setParams({ date: null })}>
          {t("today")}
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("next")}
          onClick={() => setParams({ date: shiftDate(view, date, 1) })}
        >
          <ChevronRight />
        </Button>
        <h2 className="ml-1 text-lg font-semibold first-letter:uppercase">{title}</h2>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <FilterSelect
            param="responsible"
            label={tTasks("filters.responsible")}
            allLabel={tTasks("filters.mine")}
            options={[
              { value: "everyone", label: tTasks("filters.everyone") },
              ...context.members.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
          <Tabs value={view} onValueChange={(v) => setParams({ view: v })}>
            <TabsList>
              {CALENDAR_VIEWS.map((v) => (
                <TabsTrigger key={v} value={v}>
                  {t(`views.${v}`)}
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
                {tTasks("create")}
              </Button>
            }
          />
        </div>
      </div>

      {view === "day" ? (
        <DayAgenda date={date} tasks={tasks} context={context} />
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          onDragStart={() => (dragging.current = true)}
          onDragEnd={onDragEnd}
        >
          <CalendarGrid
            from={from}
            days={days}
            month={view === "month" ? date.slice(0, 7) : null}
            byDate={byDate}
            context={context}
            now={now}
            today={today}
            dragging={dragging}
            onOpenDay={(d) => setParams({ view: "day", date: d })}
          />
        </DndContext>
      )}
    </div>
  )
}
