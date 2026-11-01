"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { FormDialog } from "@/components/shared/form/form-dialog"
import { SelectField } from "@/components/shared/form/select-field"
import { TextareaField } from "@/components/shared/form/textarea-field"
import { TextField } from "@/components/shared/form/text-field"
import { useDialogForm } from "@/lib/actions/use-dialog-form"
import type { RecordRef } from "@/lib/crm/record-ref"
import { utcToZonedInput } from "@/lib/utils/timezone"
import type { NamedOption } from "@/modules/crm-config/types"
import { PRIORITIES } from "@/modules/leads/schemas"

import { saveTask } from "../actions"
import type { TaskItem, TaskTypeOption } from "../queries"
import { taskSchema, type TaskInput } from "../schemas"

export type TaskDialogContext = {
  types: TaskTypeOption[]
  members: NamedOption[]
  currentUserId: string
  timeZone: string
}

/** Creare / editare sarcină. Termenul se introduce în fusul orar al organizației. */
export function TaskDialog({
  task,
  recordRef,
  context,
  trigger,
  defaultDue,
}: {
  task?: TaskItem
  recordRef: RecordRef | null
  context: TaskDialogContext
  trigger: ReactNode
  /** Termen implicit pentru o sarcină nouă (UTC); altfel mâine la 10:00. */
  defaultDue?: Date
}) {
  const t = useTranslations("tasks.form")
  const tPriority = useTranslations("leads.priority")

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const due = task
    ? utcToZonedInput(task.dueAt, context.timeZone)
    : defaultDue
      ? utcToZonedInput(defaultDue, context.timeZone)
      : `${utcToZonedInput(tomorrow, context.timeZone).slice(0, 10)}T10:00`

  const d = useDialogForm<TaskInput>({
    schema: taskSchema,
    defaults: {
      id: task?.id,
      title: task?.title ?? "",
      description: task?.description ?? "",
      typeId:
        task?.typeId ??
        context.types.find((x) => x.key === "call")?.id ??
        context.types[0]?.id ??
        "",
      responsibleId: task ? task.responsibleId : context.currentUserId,
      dueAt: due,
      durationMinutes: task?.durationMinutes ? String(task.durationMinutes) : "",
      priority: task?.priority ?? "normal",
      ref: recordRef,
    },
    action: saveTask,
    successKey: task ? "tasks.updated" : "tasks.created",
  })

  return (
    <FormDialog
      trigger={trigger}
      title={t(task ? "editTitle" : "createTitle")}
      open={d.open}
      onOpenChange={d.setOpen}
      onSubmit={d.onSubmit}
      error={d.error}
      submitting={d.submitting}
    >
      <TextField control={d.form.control} name="title" label={t("title")} autoFocus />
      <div className="grid gap-6 sm:grid-cols-2">
        <SelectField
          control={d.form.control}
          name="typeId"
          label={t("type")}
          options={context.types.map((x) => ({ value: x.id, label: x.name }))}
        />
        <SelectField
          control={d.form.control}
          name="responsibleId"
          label={t("responsible")}
          options={context.members.map((m) => ({ value: m.id, label: m.name }))}
          noneLabel={t("unassigned")}
        />
        <TextField control={d.form.control} name="dueAt" label={t("dueAt")} type="datetime-local" />
        <TextField
          control={d.form.control}
          name="durationMinutes"
          label={t("duration")}
          inputMode="numeric"
        />
        <SelectField
          control={d.form.control}
          name="priority"
          label={t("priority")}
          options={PRIORITIES.map((p) => ({ value: p, label: tPriority(p) }))}
        />
      </div>
      <TextareaField
        control={d.form.control}
        name="description"
        label={t("description")}
        rows={3}
      />
    </FormDialog>
  )
}
