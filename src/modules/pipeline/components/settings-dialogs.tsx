"use client"

import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { Controller } from "react-hook-form"

import { FormDialog } from "@/components/shared/form/form-dialog"
import { TextField } from "@/components/shared/form/text-field"
import { Field, FieldLabel } from "@/components/ui/field"
import { useDialogForm } from "@/lib/actions/use-dialog-form"
import { TAG_COLORS } from "@/modules/crm-config/schemas"
import type { StageOption } from "@/modules/crm-config/types"

import { savePipeline, saveStage } from "../settings-actions"
import { pipelineSchema, stageSchema, type PipelineInput, type StageInput } from "../schemas"

export function PipelineDialog({
  pipeline,
  trigger,
}: {
  pipeline?: { id: string; name: string }
  trigger: ReactNode
}) {
  const t = useTranslations("settings.pipelines")
  const d = useDialogForm<PipelineInput>({
    schema: pipelineSchema,
    defaults: { id: pipeline?.id, name: pipeline?.name ?? "" },
    action: savePipeline,
    successKey: "settings.pipelines.saved",
  })

  return (
    <FormDialog
      trigger={trigger}
      title={t(pipeline ? "renameTitle" : "createTitle")}
      open={d.open}
      onOpenChange={d.setOpen}
      onSubmit={d.onSubmit}
      error={d.error}
      submitting={d.submitting}
    >
      <TextField control={d.form.control} name="name" label={t("name")} autoFocus />
    </FormDialog>
  )
}

export function StageDialog({
  pipelineId,
  stage,
  trigger,
}: {
  pipelineId: string
  stage?: StageOption
  trigger: ReactNode
}) {
  const t = useTranslations("settings.pipelines")
  const d = useDialogForm<StageInput>({
    schema: stageSchema,
    defaults: {
      id: stage?.id,
      pipelineId,
      name: stage?.name ?? "",
      color: stage?.color ?? TAG_COLORS[1]!,
      probability: String(stage?.probability ?? 50),
    },
    action: saveStage,
    successKey: "settings.pipelines.stageSaved",
  })

  return (
    <FormDialog
      trigger={trigger}
      title={t(stage ? "editStageTitle" : "createStageTitle")}
      open={d.open}
      onOpenChange={d.setOpen}
      onSubmit={d.onSubmit}
      error={d.error}
      submitting={d.submitting}
    >
      <TextField control={d.form.control} name="name" label={t("stageName")} autoFocus />
      <TextField
        control={d.form.control}
        name="probability"
        label={t("probability")}
        inputMode="numeric"
        description={t("probabilityHint")}
      />
      <Controller
        control={d.form.control}
        name="color"
        render={({ field }) => (
          <Field>
            <FieldLabel>{t("color")}</FieldLabel>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("color")}>
              {[...TAG_COLORS, "#6366f1", "#14b8a6"].map((c) => (
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
