"use client"

import {
  Calendar,
  CheckSquare,
  FileText,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Repeat,
  Trash2,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { SelectField } from "@/components/shared/form/select-field"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import { useDialogForm } from "@/lib/actions/use-dialog-form"

import { deleteTaskType, saveTaskType } from "../actions"
import { TASK_TYPE_ICONS, taskTypeSchema, type TaskTypeInput } from "../schemas"

export const TASK_TYPE_ICON: Record<string, LucideIcon> = {
  phone: Phone,
  users: Users,
  "message-square": MessageSquare,
  mail: Mail,
  repeat: Repeat,
  "check-square": CheckSquare,
  calendar: Calendar,
  "file-text": FileText,
  "map-pin": MapPin,
  video: Video,
}

type TaskType = { id: string; name: string; icon: string; is_system: boolean }

function TaskTypeDialog({ type, trigger }: { type?: TaskType; trigger: ReactNode }) {
  const t = useTranslations("settings.taskTypes")
  const d = useDialogForm<TaskTypeInput>({
    schema: taskTypeSchema,
    defaults: {
      id: type?.id,
      name: type?.name ?? "",
      icon: (type?.icon as TaskTypeInput["icon"]) ?? "check-square",
    },
    action: saveTaskType,
    successKey: "settings.taskTypes.saved",
  })

  return (
    <FormDialog
      trigger={trigger}
      title={t(type ? "editTitle" : "createTitle")}
      open={d.open}
      onOpenChange={d.setOpen}
      onSubmit={d.onSubmit}
      error={d.error}
      submitting={d.submitting}
    >
      <TextField control={d.form.control} name="name" label={t("name")} autoFocus />
      <SelectField
        control={d.form.control}
        name="icon"
        label={t("icon")}
        options={TASK_TYPE_ICONS.map((i) => ({ value: i, label: t(`icons.${i}`) }))}
      />
    </FormDialog>
  )
}

export function TaskTypesSettings({ types, canManage }: { types: TaskType[]; canManage: boolean }) {
  const t = useTranslations("settings.taskTypes")
  const { run, pending } = useActionRunner()

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <TaskTypeDialog
            trigger={
              <Button>
                <Plus />
                {t("create")}
              </Button>
            }
          />
        </div>
      )}
      <Card className="py-0">
        <CardContent className="divide-y px-0">
          {types.map((type) => {
            const Icon = TASK_TYPE_ICON[type.icon] ?? CheckSquare
            return (
              <div key={type.id} className="flex items-center gap-3 px-4 py-3">
                <Icon className="size-4 text-muted-foreground" />
                <span className="flex-1 font-medium">{type.name}</span>
                {type.is_system && (
                  <Lock className="size-3.5 text-muted-foreground" aria-label={t("system")} />
                )}
                {canManage && (
                  <>
                    <TaskTypeDialog
                      type={type}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={t("edit")}>
                          <Pencil />
                        </Button>
                      }
                    />
                    {!type.is_system && (
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("delete")}
                            disabled={pending}
                          >
                            <Trash2 />
                          </Button>
                        }
                        title={t("deleteTitle")}
                        description={t("deleteDescription", { name: type.name })}
                        confirmLabel={t("delete")}
                        onConfirm={() =>
                          run(() => deleteTaskType({ id: type.id }), "settings.taskTypes.deleted")
                        }
                      />
                    )}
                  </>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
