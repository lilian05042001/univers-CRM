"use client"

import { useDroppable } from "@dnd-kit/core"
import { cn } from "cn"
import { Plus } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import type { RefObject } from "react"

import { Button } from "@/components/ui/button"
import { addDays, zonedInputToUtc } from "@/lib/utils/timezone"
import { TaskDialog, type TaskDialogContext } from "@/modules/tasks/components/task-dialog"
import type { TaskItem } from "@/modules/tasks/queries"

import { dateValue } from "../utils"

import { TaskChip } from "./task-chip"

const MAX_PER_CELL = 3

type Shared = {
  context: TaskDialogContext
  now: Date
  today: string
  dragging: RefObject<boolean>
  onOpenDay: (date: string) => void
}

function DayCell({
  date,
  tasks,
  muted,
  compact,
  context,
  now,
  today,
  dragging,
  onOpenDay,
}: Shared & { date: string; tasks: TaskItem[]; muted: boolean; compact: boolean }) {
  const t = useTranslations("calendar")
  const format = useFormatter()
  const { setNodeRef, isOver } = useDroppable({ id: date })
  const visible = compact ? tasks.slice(0, MAX_PER_CELL) : tasks

  return (
    <div
      ref={setNodeRef}
      data-date={date}
      className={cn(
        "group flex min-h-28 flex-col gap-1 border-r border-b p-1.5",
        muted && "bg-muted/40",
        isOver && "bg-primary/5"
      )}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onOpenDay(date)}
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs tabular-nums hover:bg-muted",
            date === today && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
            muted && date !== today && "text-muted-foreground"
          )}
          aria-label={format.dateTime(dateValue(date), { dateStyle: "full", timeZone: "UTC" })}
        >
          {Number(date.slice(8))}
        </button>
        <TaskDialog
          recordRef={null}
          context={context}
          defaultDue={zonedInputToUtc(`${date}T09:00`, context.timeZone)}
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={t("addOn", {
                date: format.dateTime(dateValue(date), { dateStyle: "medium", timeZone: "UTC" }),
              })}
            >
              <Plus />
            </Button>
          }
        />
      </div>
      {visible.map((task) => (
        <TaskChip
          key={task.id}
          task={task}
          context={context}
          now={now}
          draggable
          dragging={dragging}
        />
      ))}
      {compact && tasks.length > MAX_PER_CELL && (
        <button
          type="button"
          className="text-left text-xs text-muted-foreground hover:underline"
          onClick={() => onOpenDay(date)}
        >
          {t("more", { count: tasks.length - MAX_PER_CELL })}
        </button>
      )}
    </div>
  )
}

/** Grila lunii (6 săptămâni) sau a săptămânii; zilele acceptă sarcini trase. */
export function CalendarGrid({
  from,
  days,
  month,
  byDate,
  ...shared
}: Shared & { from: string; days: number; month: string | null; byDate: Map<string, TaskItem[]> }) {
  const format = useFormatter()
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i))

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div className="grid min-w-[700px] grid-cols-7">
        {dates.slice(0, 7).map((d) => (
          <div
            key={d}
            className="border-r border-b px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase"
          >
            {format.dateTime(dateValue(d), { weekday: "short", timeZone: "UTC" })}
            {!month && <span className="ml-1 normal-case">{Number(d.slice(8))}</span>}
          </div>
        ))}
        {dates.map((d) => (
          <DayCell
            key={d}
            date={d}
            tasks={byDate.get(d) ?? []}
            muted={month !== null && d.slice(0, 7) !== month}
            compact={month !== null}
            {...shared}
          />
        ))}
      </div>
    </div>
  )
}
