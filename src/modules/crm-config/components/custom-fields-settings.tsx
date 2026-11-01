"use client"

import { Pencil, Plus, Shapes, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { useWatch } from "react-hook-form"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { CheckboxField } from "@/components/shared/form/checkbox-field"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { SelectField } from "@/components/shared/form/select-field"
import { TextareaField } from "@/components/shared/form/textarea-field"
import { TextField } from "@/components/shared/form/text-field"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import { useDialogForm } from "@/lib/actions/use-dialog-form"

import { deleteCustomField, saveCustomField } from "../actions"
import { FIELD_ENTITIES, FIELD_TYPES, customFieldSchema, type CustomFieldInput } from "../schemas"
import type { CustomFieldDef } from "../types"

function FieldDialog({ field, trigger }: { field?: CustomFieldDef; trigger: ReactNode }) {
  const t = useTranslations("settings.fields")
  const d = useDialogForm<CustomFieldInput>({
    schema: customFieldSchema,
    defaults: {
      id: field?.id,
      entity: field?.entity ?? "lead",
      label: field?.label ?? "",
      type: field?.type ?? "text",
      options: field?.options.join("\n") ?? "",
      isRequired: field?.isRequired ?? false,
    },
    action: saveCustomField,
    successKey: "settings.fields.saved",
  })
  const type = useWatch({ control: d.form.control, name: "type" })

  return (
    <FormDialog
      trigger={trigger}
      title={t(field ? "editTitle" : "createTitle")}
      open={d.open}
      onOpenChange={d.setOpen}
      onSubmit={d.onSubmit}
      error={d.error}
      submitting={d.submitting}
    >
      {!field && (
        <SelectField
          control={d.form.control}
          name="entity"
          label={t("entity")}
          options={FIELD_ENTITIES.map((e) => ({ value: e, label: t(`entities.${e}`) }))}
        />
      )}
      <TextField control={d.form.control} name="label" label={t("label")} autoFocus />
      <SelectField
        control={d.form.control}
        name="type"
        label={t("type")}
        options={FIELD_TYPES.map((x) => ({ value: x, label: t(`types.${x}`) }))}
      />
      {(type === "select" || type === "multiselect") && (
        <TextareaField control={d.form.control} name="options" label={t("options")} rows={4} />
      )}
      {type !== "bool" && (
        <CheckboxField control={d.form.control} name="isRequired" label={t("required")} />
      )}
    </FormDialog>
  )
}

export function CustomFieldsSettings({
  fields,
  canManage,
}: {
  fields: CustomFieldDef[]
  canManage: boolean
}) {
  const t = useTranslations("settings.fields")
  const { run, pending } = useActionRunner()

  const create = canManage && (
    <FieldDialog
      trigger={
        <Button>
          <Plus />
          {t("create")}
        </Button>
      }
    />
  )

  if (fields.length === 0) {
    return (
      <EmptyState
        icon={Shapes}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={create}
      />
    )
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {create && <div className="flex justify-end">{create}</div>}
      {FIELD_ENTITIES.map((entity) => {
        const list = fields.filter((f) => f.entity === entity)
        if (list.length === 0) return null
        return (
          <Card key={entity} className="gap-0 pb-0">
            <CardHeader className="pb-3">
              <CardTitle>{t(`entities.${entity}`)}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y border-t px-0">
              {list.map((f) => (
                <div key={f.id} className="flex flex-wrap items-center gap-2 px-6 py-3">
                  <span className="font-medium">{f.label}</span>
                  <StatusBadge tone="info">{t(`types.${f.type}`)}</StatusBadge>
                  {f.isRequired && <StatusBadge tone="warning">{t("requiredBadge")}</StatusBadge>}
                  {canManage && (
                    <div className="ml-auto flex gap-1">
                      <FieldDialog
                        field={f}
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
                        description={t("deleteDescription", { name: f.label })}
                        confirmLabel={t("delete")}
                        onConfirm={() =>
                          run(() => deleteCustomField({ id: f.id }), "settings.fields.deleted")
                        }
                      />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
