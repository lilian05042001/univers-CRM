"use client"

import { cn } from "cn"
import { Pencil } from "lucide-react"
import Link from "next/link"
import { useFormatter, useNow, useTranslations } from "next-intl"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import type { RecordRef } from "@/lib/crm/record-ref"

import { setTaskStatus } from "../actions"
import type { TaskItem } from "../queries"

import { TaskDialog, type TaskDialogContext } from "./task-dialog"

/** „Întârziată” se calculează (nu se stochează): termen depășit și sarcină deschisă. */
export const isOverdue = (task: TaskItem, now: Date) =>
  (task.status === "new" || task.status === "in_progress") && new Date(task.dueAt) < now

export function TaskRow({
  task,
  context,
  recordRef,
  showRecord,
}: {
  task: TaskItem
  context: TaskDialogContext
  recordRef: RecordRef | null
  showRecord?: boolean
}) {
  const t = useTranslations("tasks")
  const format = useFormatter()
  const now = useNow()
  const { run, pending } = useActionRunner()
  const done = task.status === "done"
  const closed = done || task.status === "cancelled"
  const overdue = isOverdue(task, now)
  const responsible = context.members.find((m) => m.id === task.responsibleId)?.name

  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <Checkbox
        className="mt-0.5"
        checked={done}
        disabled={pending || task.status === "cancelled"}
        aria-label={t(done ? "reopen" : "complete", { title: task.title })}
        onCheckedChange={(v) =>
          run(
            () => setTaskStatus({ id: task.id, status: v ? "done" : "new" }),
            v ? "tasks.completed" : undefined
          )
        }
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", closed && "text-muted-foreground line-through")}>
          {task.title}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>{task.typeName}</span>
          <span className={cn(overdue && "font-medium text-destructive")}>
            {format.dateTime(new Date(task.dueAt), { dateStyle: "medium", timeStyle: "short" })}
          </span>
          {responsible && <span>{responsible}</span>}
          {showRecord && task.lead && (
            <Link href={`/leads/${task.lead.id}`} className="text-primary hover:underline">
              {task.lead.title}
            </Link>
          )}
          {showRecord && !task.lead && task.contact && (
            <Link href={`/contacts/${task.contact.id}`} className="text-primary hover:underline">
              {task.contact.name}
            </Link>
          )}
        </p>
        {task.result && <p className="mt-1 text-xs whitespace-pre-line">{task.result}</p>}
      </div>
      {overdue && <StatusBadge tone="danger">{t("statuses.overdue")}</StatusBadge>}
      {task.status === "cancelled" && (
        <StatusBadge tone="neutral">{t("statuses.cancelled")}</StatusBadge>
      )}
      {!closed && (
        <TaskDialog
          task={task}
          recordRef={recordRef}
          context={context}
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={t("edit")}>
              <Pencil />
            </Button>
          }
        />
      )}
    </li>
  )
}
