"use client"

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useFieldArray, useWatch, type Control } from "react-hook-form"

import { MultiSelectField } from "@/components/shared/form/multi-select-field"
import { SelectField } from "@/components/shared/form/select-field"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ACTION_TYPES, type ActionType } from "@/lib/automation-engine/types"

import { valueOptions, type EditorOptions } from "../fields"
import {
  ASSIGN_STRATEGIES,
  NOTIFY_RECIPIENTS,
  PRIORITIES,
  TASK_ASSIGNEES,
  emptyAction,
  type AutomationInput,
} from "../schemas"

function ActionFields({
  control,
  index,
  options,
}: {
  control: Control<AutomationInput>
  index: number
  options: EditorOptions
}) {
  const t = useTranslations("automations.actions")
  const tPriority = useTranslations("leads.priority")
  const [type, assignee, recipient] = useWatch({
    control,
    name: [`actions.${index}.type`, `actions.${index}.assignee`, `actions.${index}.recipient`],
  })
  const name = <K extends string>(k: K) => `actions.${index}.${k}` as const
  const members = options.members.map((m) => ({ value: m.id, label: m.name }))

  switch (type) {
    case "assign_responsible":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            control={control}
            name={name("strategy")}
            label={t("strategy")}
            options={ASSIGN_STRATEGIES.map((s) => ({ value: s, label: t(`strategies.${s}`) }))}
          />
          <MultiSelectField
            control={control}
            name={name("user_ids")}
            label={t("users")}
            options={members}
          />
        </div>
      )
    case "create_task":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField control={control} name={name("title")} label={t("taskTitle")} />
          <SelectField
            control={control}
            name={name("task_type_id")}
            label={t("taskType")}
            noneLabel={t("taskTypeDefault")}
            options={options.taskTypes.map((x) => ({ value: x.id, label: x.name }))}
          />
          <TextField
            control={control}
            name={name("due_in_hours")}
            label={t("dueInHours")}
            inputMode="numeric"
          />
          <SelectField
            control={control}
            name={name("priority")}
            label={t("priority")}
            options={PRIORITIES.map((p) => ({ value: p, label: tPriority(p) }))}
          />
          <SelectField
            control={control}
            name={name("assignee")}
            label={t("assignee")}
            options={TASK_ASSIGNEES.map((a) => ({ value: a, label: t(`assignees.${a}`) }))}
          />
          {assignee === "user" && (
            <SelectField
              control={control}
              name={name("user_id")}
              label={t("user")}
              options={members}
            />
          )}
        </div>
      )
    case "notify":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            control={control}
            name={name("recipient")}
            label={t("recipient")}
            options={NOTIFY_RECIPIENTS.map((r) => ({ value: r, label: t(`recipients.${r}`) }))}
          />
          {recipient === "user" && (
            <SelectField
              control={control}
              name={name("user_id")}
              label={t("user")}
              options={members}
            />
          )}
          <div className="sm:col-span-2">
            <TextField control={control} name={name("message")} label={t("message")} />
          </div>
        </div>
      )
    case "add_tag":
      return (
        <SelectField
          control={control}
          name={name("tag_id")}
          label={t("tag")}
          options={options.tags.map((x) => ({ value: x.id, label: x.name }))}
        />
      )
    case "change_stage":
      return (
        <SelectField
          control={control}
          name={name("stage_id")}
          label={t("stage")}
          options={valueOptions("stage", options, String) ?? []}
        />
      )
    default:
      return <p className="text-sm text-muted-foreground">{t(`hints.${type}`)}</p>
  }
}

/** Lista ordonată de acțiuni; se execută toate sau niciuna (o tranzacție). */
export function ActionsEditor({
  control,
  options,
}: {
  control: Control<AutomationInput>
  options: EditorOptions
}) {
  const t = useTranslations("automations.actions")
  const { fields, append, remove, move, update } = useFieldArray({ control, name: "actions" })
  const actions = useWatch({ control, name: "actions" })

  return (
    <div className="flex flex-col gap-3">
      {fields.map((f, i) => (
        <div key={f.id} className="flex flex-col gap-4 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {i + 1}
            </span>
            <Select
              value={actions[i]?.type}
              onValueChange={(type) => update(i, emptyAction(type as ActionType))}
            >
              <SelectTrigger className="w-full max-w-72" aria-label={t("type")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("up")}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("down")}
                disabled={i === fields.length - 1}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("remove")}
                disabled={fields.length === 1}
                onClick={() => remove(i)}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
          <ActionFields control={control} index={i} options={options} />
        </div>
      ))}
      {fields.length < 10 && (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(emptyAction("notify"))}
          >
            <Plus />
            {t("add")}
          </Button>
        </div>
      )}
    </div>
  )
}
