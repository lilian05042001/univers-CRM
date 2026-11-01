"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { DuplicateWarning, type DuplicateMatch } from "@/components/shared/duplicate-warning"
import { EntityPickerField } from "@/components/shared/form/entity-picker-field"
import { FormError } from "@/components/shared/form/form-error"
import { MultiSelectField } from "@/components/shared/form/multi-select-field"
import { SelectField } from "@/components/shared/form/select-field"
import { TextField } from "@/components/shared/form/text-field"
import { ValueListField } from "@/components/shared/form/value-list-field"
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
import { useActionRunner } from "@/lib/actions/use-action-runner"
import { formatPhone } from "@/lib/utils/phone"
import { searchCompanyOptions } from "@/modules/companies/actions"
import { CustomFieldsSection } from "@/modules/crm-config/components/custom-fields-section"
import { toFormValues } from "@/modules/crm-config/custom-fields"
import { toSelectOptions } from "@/modules/crm-config/options"
import type { CrmOptions } from "@/modules/crm-config/types"

import { checkContactDuplicates, mergeContacts, saveContact } from "../actions"
import type { ContactRecord } from "../queries"
import { contactSchema, type ContactInput } from "../schemas"

function toDefaults(record: ContactRecord | null, options: CrmOptions): ContactInput {
  const defs = options.customFields.filter((d) => d.entity === "contact")
  const address = (record?.address ?? {}) as { city?: string; street?: string }
  const values = (type: string) =>
    (record?.identities ?? [])
      .filter((i) => i.type === type)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
      .map((i) => ({ value: type === "phone" ? formatPhone(i.value) : i.value }))
  const phones = values("phone")
  const emails = values("email")

  return {
    id: record?.id,
    firstName: record?.first_name ?? "",
    lastName: record?.last_name ?? "",
    phones: phones.length ? phones : [{ value: "" }],
    emails: emails.length ? emails : [{ value: "" }],
    companyId: record?.company?.id ?? null,
    position: record?.position ?? "",
    sourceId: record?.source_id ?? null,
    ownerId: record?.owner_id ?? null,
    tagIds: record?.tags.map((t) => t.tag_id) ?? [],
    city: address.city ?? "",
    street: address.street ?? "",
    customFields: toFormValues(defs, record?.custom_fields),
  }
}

export function ContactFormDialog({
  record,
  options,
  canMerge,
  onClose,
}: {
  record: ContactRecord | null
  options: CrmOptions
  canMerge: boolean
  onClose: () => void
}) {
  const t = useTranslations("contacts.form")
  const [error, setError] = useState<string | null>(null)
  const dialog = useRouteDialog(onClose)
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const { run, pending: merging } = useActionRunner()

  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: toDefaults(record, options),
  })
  const phones = useWatch({ control: form.control, name: "phones" })
  const emails = useWatch({ control: form.control, name: "emails" })
  const identityKey = JSON.stringify([phones, emails])

  // Verificarea duplicatelor pe măsură ce se completează telefonul / e-mailul.
  useEffect(() => {
    const id = setTimeout(async () => {
      const [p, e] = JSON.parse(identityKey) as [{ value: string }[], { value: string }[]]
      const result = await checkContactDuplicates({
        phones: p.map((x) => x.value),
        emails: e.map((x) => x.value),
        excludeId: record?.id ?? null,
      })
      if (result.ok) {
        setDuplicates(
          result.data.map((d) => ({
            id: d.contact_id,
            name: d.full_name,
            matchedType: d.matched_type,
            isVisible: d.is_visible,
          }))
        )
      }
    }, 500)
    return () => clearTimeout(id)
  }, [identityKey, record?.id])

  async function onSubmit(values: ContactInput) {
    setError(null)
    const result = await saveContact(values)
    if (!result.ok) {
      setError(applyActionResult(form, result))
      return
    }
    toast.success(t(record ? "updated" : "created"))
    dialog.close()
  }

  const defs = options.customFields.filter((d) => d.entity === "contact")
  const ownerOptions = toSelectOptions(options.members)

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
              <TextField control={form.control} name="firstName" label={t("firstName")} autoFocus />
              <TextField control={form.control} name="lastName" label={t("lastName")} />
              <ValueListField
                control={form.control}
                name="phones"
                label={t("phones")}
                addLabel={t("addPhone")}
                type="tel"
              />
              <ValueListField
                control={form.control}
                name="emails"
                label={t("emails")}
                addLabel={t("addEmail")}
                type="email"
              />
            </div>
            <DuplicateWarning
              matches={duplicates}
              hrefBase="/contacts"
              onMerge={
                record && canMerge
                  ? (removeId) =>
                      run(
                        () => mergeContacts({ keepId: record.id, removeId }),
                        "contacts.merged",
                        () => setDuplicates((d) => d.filter((x) => x.id !== removeId))
                      )
                  : undefined
              }
            />
            <div className="grid gap-6 sm:grid-cols-2">
              <EntityPickerField
                control={form.control}
                name="companyId"
                label={t("company")}
                search={searchCompanyOptions}
                initial={
                  record?.company ? { id: record.company.id, label: record.company.name } : null
                }
              />
              <TextField control={form.control} name="position" label={t("position")} />
              <SelectField
                control={form.control}
                name="sourceId"
                label={t("source")}
                options={toSelectOptions(options.sources)}
                noneLabel={t("none")}
              />
              <SelectField
                control={form.control}
                name="ownerId"
                label={t("owner")}
                options={ownerOptions}
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
              <Button type="submit" disabled={form.formState.isSubmitting || merging}>
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
