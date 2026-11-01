"use client"

import { useDraggable } from "@dnd-kit/core"
import { cn } from "cn"
import type { MouseEvent, RefObject } from "react"

import { utcToZonedInput } from "@/lib/utils/timezone"
import { TaskDialog, type TaskDialogContext } from "@/modules/tasks/components/task-dialog"
import type { TaskItem } from "@/modules/tasks/queries"

/**
 * O sarcină în calendar: click = editare, tragere (doar în vederea lunară) = reprogramare.
 * `dragging` blochează click-ul trimis de browser imediat după o tragere.
 */
export function TaskChip({
  task,
  context,
  now,
  draggable,
  dragging,
}: {
  task: TaskItem
  context: TaskDialogContext
  now: Date
  draggable: boolean
  dragging: RefObject<boolean>
}) {
  // Fără `attributes` (role="button"): interiorul e deja un buton; tragerea e doar cu mouse/touch.
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !draggable,
  })
  const done = task.status === "done"
  const overdue = !done && new Date(task.dueAt) < now
  const time = utcToZonedInput(task.dueAt, context.timeZone).slice(11)

  function suppressClickAfterDrag(event: MouseEvent) {
    if (dragging.current) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      onClickCapture={suppressClickAfterDrag}
      className={cn("touch-none", isDragging && "opacity-40")}
    >
      <TaskDialog
        task={done ? undefined : task}
        recordRef={null}
        context={context}
        trigger={
          <button
            type="button"
            title={task.title}
            className={cn(
              "flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-xs",
              done
                ? "bg-muted text-muted-foreground line-through"
                : overdue
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
            )}
          >
            <span className="shrink-0 tabular-nums">{time}</span>
            <span className="truncate">{task.title}</span>
          </button>
        }
      />
    </div>
  )
}
