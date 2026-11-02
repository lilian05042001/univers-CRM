"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { History, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, type ReactNode } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { FormError } from "@/components/shared/form/form-error"
import { SelectField } from "@/components/shared/form/select-field"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { applyActionResult } from "@/lib/actions/apply-result"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import { TRIGGER_TYPES } from "@/lib/automation-engine/types"

import { deleteAutomation, saveAutomation } from "../actions"
import { i18nKey, valueOptions, type EditorOptions } from "../fields"
import { automationSchema, type AutomationInput } from "../schemas"

import { ActionsEditor } from "./actions-editor"
import { ConditionsEditor } from "./conditions-editor"

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}

/** Editorul: declanșator → condiții → acțiuni. Fără automations.manage, doar citire. */
export function AutomationEditor({
  initial,
  options,
  canManage,
}: {
  initial: AutomationInput
  options: EditorOptions
  canManage: boolean
}) {
  const t = useTranslations("automations.editor")
  const tAll = useTranslations()
  const router = useRouter()
  const { run, pending } = useActionRunner()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<AutomationInput>({
    resolver: zodResolver(automationSchema),
    defaultValues: initial,
  })
  const triggerType = useWatch({ control: form.control, name: "triggerType" })

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    const result = await saveAutomation(values)
    if (!result.ok) {
      setError(applyActionResult(form, result) ?? (result.fieldErrors ? "errors.validation" : null))
      return
    }
    toast.success(tAll("automations.editor.saved"))
    if (!values.id) router.push(`/automations/${result.data.id}`)
    else router.refresh()
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-4xl flex-col gap-6">
      <fieldset disabled={!canManage} className="flex flex-col gap-6">
        <FormError error={error} />
        <Section title={t("general")}>
          <TextField control={form.control} name="name" label={t("name")} />
          <TextField control={form.control} name="description" label={t("description")} />
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />
                <FieldLabel htmlFor="isActive">{t("active")}</FieldLabel>
              </Field>
            )}
          />
        </Section>

        <Section title={t("trigger")} description={t("triggerHint")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="triggerType"
              label={t("triggerType")}
              options={TRIGGER_TYPES.map((x) => ({
                value: x,
                label: tAll(`automations.triggers.${i18nKey(x)}`),
              }))}
            />
            {triggerType === "lead.stage_entered" && (
              <SelectField
                control={form.control}
                name="stageId"
                label={t("stage")}
                options={valueOptions("stage", options, String) ?? []}
              />
            )}
            {triggerType === "task.due_soon" && (
              <TextField
                control={form.control}
                name="minutes"
                label={t("minutes")}
                inputMode="numeric"
              />
            )}
            {triggerType === "lead.inactive" && (
              <TextField control={form.control} name="days" label={t("days")} inputMode="numeric" />
            )}
            <SelectField
              control={form.control}
              name="pipelineId"
              label={t("pipeline")}
              noneLabel={t("allPipelines")}
              options={options.pipelines.map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
        </Section>

        <Section title={t("conditions")} description={t("conditionsHint")}>
          <ConditionsEditor control={form.control} setValue={form.setValue} options={options} />
        </Section>

        <Section title={t("actions")} description={t("actionsHint")}>
          <ActionsEditor control={form.control} options={options} />
        </Section>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        {canManage && (
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Spinner />}
            {t("save")}
          </Button>
        )}
        {initial.id && (
          <Button asChild variant="outline">
            <Link href={`/automations/runs?automation=${initial.id}`}>
              <History />
              {t("history")}
            </Link>
          </Button>
        )}
        {canManage && initial.id && (
          <ConfirmDialog
            trigger={
              <Button
                type="button"
                variant="ghost"
                className="ml-auto text-destructive"
                disabled={pending}
              >
                <Trash2 />
                {t("delete")}
              </Button>
            }
            title={t("deleteTitle")}
            description={t("deleteDescription", { name: initial.name })}
            confirmLabel={t("delete")}
            onConfirm={() =>
              run(
                () => deleteAutomation({ id: initial.id! }),
                "automations.editor.deleted",
                () => router.push("/automations")
              )
            }
          />
        )}
      </div>
    </form>
  )
}
