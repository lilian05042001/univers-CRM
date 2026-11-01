"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { EntityPickerField } from "@/components/shared/form/entity-picker-field"
import { FormError } from "@/components/shared/form/form-error"
import { MultiSelectField } from "@/components/shared/form/multi-select-field"
import { SelectField } from "@/components/shared/form/select-field"
import { TextareaField } from "@/components/shared/form/textarea-field"
import { TextField } from "@/components/shared/form/text-field"
import { TagBadge } from "@/components/shared/tag-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FieldGroup, FieldSeparator } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { useRouteDialog } from "@/hooks/use-route-dialog"
import { applyActionResult } from "@/lib/actions/apply-result"
import { searchCompanyOptions } from "@/modules/companies/actions"
import { searchContactOptions } from "@/modules/contacts/actions"
import { CustomFieldsSection } from "@/modules/crm-config/components/custom-fields-section"
import { toFormValues } from "@/modules/crm-config/custom-fields"
import { toSelectOptions } from "@/modules/crm-config/options"
import type { CrmOptions } from "@/modules/crm-config/types"

import { saveLead } from "../actions"
import type { LeadRecord } from "../queries"
import { PRIORITIES, leadSchema, type LeadInput } from "../schemas"

function toDefaults(record: LeadRecord | null, options: CrmOptions, userId: string): LeadInput {
  const pipeline = options.pipelines.find((p) => p.isDefault) ?? options.pipelines[0]
  const contact = record?.contacts.find((c) => c.is_primary) ?? record?.contacts[0]
  return {
    id: record?.id,
    title: record?.title ?? "",
    pipelineId: record?.pipeline_id ?? pipeline?.id ?? "",
    stageId: record?.stage_id ?? pipeline?.stages[0]?.id ?? "",
    value: record ? String(Number(record.value)) : "",
    contactId: contact?.contact.id ?? null,
    newContactName: "",
    newContactPhone: "",
    newContactEmail: "",
    companyId: record?.company?.id ?? null,
    sourceId: record?.source_id ?? null,
    responsibleId: record ? record.responsible_id : userId,
    teamId: record?.team_id ?? null,
    priority: record?.priority ?? "normal",
    tagIds: record?.tags.map((t) => t.tag_id) ?? [],
    description: record?.description ?? "",
    lossReasonId: record?.loss_reason_id ?? null,
    lossComment: record?.loss_comment ?? "",
    customFields: toFormValues(
      options.customFields.filter((d) => d.entity === "lead"),
      record?.custom_fields
    ),
  }
}

export function LeadFormDialog({
  record,
  options,
  canAssign,
  userId,
  onClose,
}: {
  record: LeadRecord | null
  options: CrmOptions
  canAssign: boolean
  userId: string
  onClose: () => void
}) {
  const t = useTranslations("leads.form")
  const tPriority = useTranslations("leads.priority")
  const [error, setError] = useState<string | null>(null)
  const dialog = useRouteDialog(onClose)
  const form = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: toDefaults(record, options, userId),
  })
  const [pipelineId, stageId, contactId] = useWatch({
    control: form.control,
    name: ["pipelineId", "stageId", "contactId"],
  })
  const pipeline = options.pipelines.find((p) => p.id === pipelineId)
  const stage = pipeline?.stages.find((s) => s.id === stageId)

  // Schimbarea pipeline-ului alege prima lui etapă.
  useEffect(() => {
    if (pipeline && !pipeline.stages.some((s) => s.id === stageId)) {
      form.setValue("stageId", pipeline.stages[0]?.id ?? "")
    }
  }, [pipeline, stageId, form])

  async function onSubmit(values: LeadInput) {
    setError(null)
    const result = await saveLead(values)
    if (!result.ok) {
      setError(applyActionResult(form, result))
      return
    }
    toast.success(t(record ? "updated" : "created"))
    dialog.close()
  }

  const contact = record?.contacts.find((c) => c.is_primary) ?? record?.contacts[0]
  const defs = options.customFields.filter((d) => d.entity === "lead")
  const responsibleOptions = toSelectOptions(
    canAssign ? options.members : options.members.filter((m) => m.id === userId)
  )

  return (
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t(record ? "editTitle" : "createTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <FormError error={error} />
            <TextField control={form.control} name="title" label={t("title")} autoFocus />
            <div className="grid gap-6 sm:grid-cols-3">
              {options.pipelines.length > 1 && (
                <SelectField
                  control={form.control}
                  name="pipelineId"
                  label={t("pipeline")}
                  options={toSelectOptions(options.pipelines)}
                />
              )}
              <SelectField
                control={form.control}
                name="stageId"
                label={t("stage")}
                options={toSelectOptions(pipeline?.stages ?? [])}
              />
              <TextField
                control={form.control}
                name="value"
                label={t("value")}
                inputMode="decimal"
              />
              <SelectField
                control={form.control}
                name="priority"
                label={t("priority")}
                options={PRIORITIES.map((p) => ({ value: p, label: tPriority(p) }))}
              />
            </div>
            {stage?.kind === "lost" && (
              <div className="grid gap-6 sm:grid-cols-2">
                <SelectField
                  control={form.control}
                  name="lossReasonId"
                  label={t("lossReason")}
                  options={toSelectOptions(options.lossReasons)}
                />
                <TextField control={form.control} name="lossComment" label={t("lossComment")} />
              </div>
            )}

            <FieldSeparator>{t("client")}</FieldSeparator>
            <div className="grid gap-6 sm:grid-cols-2">
              <EntityPickerField
                control={form.control}
                name="contactId"
                label={t("contact")}
                search={searchContactOptions}
                initial={
                  contact
                    ? { id: contact.contact.id, label: contact.contact.full_name ?? "" }
                    : null
                }
                placeholder={t("contactPlaceholder")}
              />
              <EntityPickerField
                control={form.control}
                name="companyId"
                label={t("company")}
                search={searchCompanyOptions}
                initial={
                  record?.company ? { id: record.company.id, label: record.company.name } : null
                }
              />
            </div>
            {!contactId && (
              <div className="grid gap-6 rounded-lg border border-dashed p-4 sm:grid-cols-3">
                <TextField
                  control={form.control}
                  name="newContactName"
                  label={t("newContactName")}
                />
                <TextField
                  control={form.control}
                  name="newContactPhone"
                  label={t("newContactPhone")}
                  type="tel"
                />
                <TextField
                  control={form.control}
                  name="newContactEmail"
                  label={t("newContactEmail")}
                  type="email"
                />
              </div>
            )}

            <FieldSeparator>{t("details")}</FieldSeparator>
            <div className="grid gap-6 sm:grid-cols-3">
              <SelectField
                control={form.control}
                name="responsibleId"
                label={t("responsible")}
                options={responsibleOptions}
                noneLabel={t("unassigned")}
              />
              <SelectField
                control={form.control}
                name="teamId"
                label={t("team")}
                options={toSelectOptions(options.teams)}
                noneLabel={t("none")}
              />
              <SelectField
                control={form.control}
                name="sourceId"
                label={t("source")}
                options={toSelectOptions(options.sources)}
                noneLabel={t("none")}
              />
            </div>
            <MultiSelectField
              control={form.control}
              name="tagIds"
              label={t("tags")}
              options={options.tags.map((tag) => ({
                value: tag.id,
                label: tag.name,
                render: <TagBadge name={tag.name} color={tag.color} />,
              }))}
            />
            <TextareaField
              control={form.control}
              name="description"
              label={t("description")}
              rows={3}
            />
            {defs.length > 0 && <FieldSeparator>{t("customFields")}</FieldSeparator>}
            <CustomFieldsSection control={form.control} defs={defs} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={dialog.close}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Spinner />}
                {t("save")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
