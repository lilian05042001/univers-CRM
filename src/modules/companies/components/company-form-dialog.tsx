"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { DuplicateWarning, type DuplicateMatch } from "@/components/shared/duplicate-warning"
import { FormError } from "@/components/shared/form/form-error"
import { MultiSelectField } from "@/components/shared/form/multi-select-field"
import { SelectField } from "@/components/shared/form/select-field"
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
import { formatPhone } from "@/lib/utils/phone"
import { CustomFieldsSection } from "@/modules/crm-config/components/custom-fields-section"
import { toFormValues } from "@/modules/crm-config/custom-fields"
import { toSelectOptions } from "@/modules/crm-config/options"
import type { CrmOptions } from "@/modules/crm-config/types"

import { checkCompanyDuplicates, saveCompany } from "../actions"
import type { CompanyRecord } from "../queries"
import { companySchema, type CompanyInput } from "../schemas"

function toDefaults(record: CompanyRecord | null, options: CrmOptions): CompanyInput {
  const address = (record?.address ?? {}) as { city?: string; street?: string }
  return {
    id: record?.id,
    name: record?.name ?? "",
    industry: record?.industry ?? "",
    phone: record?.phone ? formatPhone(record.phone) : "",
    email: record?.email ?? "",
    website: record?.website ?? "",
    ownerId: record?.owner_id ?? null,
    tagIds: record?.tags.map((t) => t.tag_id) ?? [],
    city: address.city ?? "",
    street: address.street ?? "",
    customFields: toFormValues(
      options.customFields.filter((d) => d.entity === "company"),
      record?.custom_fields
    ),
  }
}

export function CompanyFormDialog({
  record,
  options,
  onClose,
}: {
  record: CompanyRecord | null
  options: CrmOptions
  onClose: () => void
}) {
  const t = useTranslations("companies.form")
  const [error, setError] = useState<string | null>(null)
  const dialog = useRouteDialog(onClose)
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])

  const form = useForm<CompanyInput>({
    resolver: zodResolver(companySchema),
    defaultValues: toDefaults(record, options),
  })
  const [name, phone, email] = useWatch({ control: form.control, name: ["name", "phone", "email"] })

  useEffect(() => {
    const id = setTimeout(async () => {
      const result = await checkCompanyDuplicates({
        name,
        phone,
        email,
        excludeId: record?.id ?? null,
      })
      if (result.ok) {
        setDuplicates(
          result.data.map((d) => ({
            id: d.company_id,
            name: d.name,
            matchedType: d.matched_type,
            isVisible: d.is_visible,
          }))
        )
      }
    }, 500)
    return () => clearTimeout(id)
  }, [name, phone, email, record?.id])

  async function onSubmit(values: CompanyInput) {
    setError(null)
    const result = await saveCompany(values)
    if (!result.ok) {
      setError(applyActionResult(form, result))
      return
    }
    toast.success(t(record ? "updated" : "created"))
    dialog.close()
  }

  const defs = options.customFields.filter((d) => d.entity === "company")

  return (
    <Dialog open={dialog.open} onOpenChange={dialog.onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t(record ? "editTitle" : "createTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <FormError error={error} />
            <div className="grid gap-6 sm:grid-cols-2">
              <TextField control={form.control} name="name" label={t("name")} autoFocus />
              <TextField control={form.control} name="industry" label={t("industry")} />
              <TextField control={form.control} name="phone" label={t("phone")} type="tel" />
              <TextField control={form.control} name="email" label={t("email")} type="email" />
            </div>
            <DuplicateWarning matches={duplicates} hrefBase="/companies" />
            <div className="grid gap-6 sm:grid-cols-2">
              <TextField control={form.control} name="website" label={t("website")} />
              <SelectField
                control={form.control}
                name="ownerId"
                label={t("owner")}
                options={toSelectOptions(options.members)}
                noneLabel={t("unassigned")}
              />
              <TextField control={form.control} name="city" label={t("city")} />
              <TextField control={form.control} name="street" label={t("street")} />
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
