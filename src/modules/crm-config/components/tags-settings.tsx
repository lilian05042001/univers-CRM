"use client"

import { Pencil, Plus, Tags, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { Controller } from "react-hook-form"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { TextField } from "@/components/shared/form/text-field"
import { TagBadge } from "@/components/shared/tag-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import { useDialogForm } from "@/lib/actions/use-dialog-form"

import { deleteTag, saveTag } from "../actions"
import { TAG_COLORS, tagSchema, type TagInput } from "../schemas"
import type { TagOption } from "../types"

function TagDialog({ tag, trigger }: { tag?: TagOption; trigger: ReactNode }) {
  const t = useTranslations("settings.tags")
  const d = useDialogForm<TagInput>({
    schema: tagSchema,
    defaults: { id: tag?.id, name: tag?.name ?? "", color: tag?.color ?? TAG_COLORS[1]! },
    action: saveTag,
    successKey: "settings.tags.saved",
  })

  return (
    <FormDialog
      trigger={trigger}
      title={t(tag ? "editTitle" : "createTitle")}
      open={d.open}
      onOpenChange={d.setOpen}
      onSubmit={d.onSubmit}
      error={d.error}
      submitting={d.submitting}
    >
      <TextField control={d.form.control} name="name" label={t("name")} autoFocus />
      <Controller
        control={d.form.control}
        name="color"
        render={({ field }) => (
          <Field>
            <FieldLabel>{t("color")}</FieldLabel>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("color")}>
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={field.value === c}
                  aria-label={c}
                  onClick={() => field.onChange(c)}
                  className="size-7 rounded-full ring-offset-2 ring-offset-background aria-checked:ring-2 aria-checked:ring-ring"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </Field>
        )}
      />
    </FormDialog>
  )
}

export function TagsSettings({ tags, canManage }: { tags: TagOption[]; canManage: boolean }) {
  const t = useTranslations("settings.tags")
  const { run, pending } = useActionRunner()

  const create = canManage && (
    <TagDialog
      trigger={
        <Button>
          <Plus />
          {t("create")}
        </Button>
      }
    />
  )

  if (tags.length === 0) {
    return (
      <EmptyState
        icon={Tags}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={create}
      />
    )
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {create && <div className="flex justify-end">{create}</div>}
      <Card className="py-0">
        <CardContent className="divide-y px-0">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2 px-4 py-3">
              <TagBadge name={tag.name} color={tag.color} />
              {canManage && (
                <div className="ml-auto flex gap-1">
                  <TagDialog
                    tag={tag}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={t("edit")}>
                        <Pencil />
                      </Button>
                    }
                  />
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
                    description={t("deleteDescription", { name: tag.name })}
                    confirmLabel={t("delete")}
                    onConfirm={() => run(() => deleteTag({ id: tag.id }), "settings.tags.deleted")}
                  />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
