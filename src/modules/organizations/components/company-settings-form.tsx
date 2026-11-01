"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormError } from "@/components/shared/form/form-error"
import { SelectField } from "@/components/shared/form/select-field"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { applyActionResult } from "@/lib/actions/apply-result"

import { updateCompanySettings } from "../actions"
import {
  CURRENCIES,
  LOCALES,
  TIMEZONES,
  companySettingsSchema,
  type CompanySettingsInput,
} from "../schemas"

export function CompanySettingsForm({
  defaultValues,
  readOnly,
}: {
  defaultValues: CompanySettingsInput
  readOnly: boolean
}) {
  const t = useTranslations("settings.company")
  const tLocales = useTranslations("locales")
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<CompanySettingsInput>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues,
  })

  async function onSubmit(values: CompanySettingsInput) {
    setError(null)
    const result = await updateCompanySettings(values)
    if (!result.ok) {
      setError(applyActionResult(form, result))
      return
    }
    toast.success(t("saved"))
    form.reset(values)
    router.refresh()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <fieldset disabled={readOnly}>
        <FieldGroup>
          <FormError error={error} />
          <div className="grid gap-6 md:grid-cols-2">
            <TextField control={form.control} name="name" label={t("name")} />
            <TextField control={form.control} name="legalName" label={t("legalName")} />
            <TextField control={form.control} name="fiscalCode" label={t("fiscalCode")} />
            <TextField control={form.control} name="country" label={t("country")} maxLength={2} />
            <SelectField
              control={form.control}
              name="currency"
              label={t("currency")}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              disabled={readOnly}
            />
            <SelectField
              control={form.control}
              name="timezone"
              label={t("timezone")}
              options={TIMEZONES.map((z) => ({ value: z, label: z }))}
              disabled={readOnly}
            />
            <SelectField
              control={form.control}
              name="defaultLocale"
              label={t("defaultLocale")}
              options={LOCALES.map((l) => ({ value: l, label: tLocales(l) }))}
              disabled={readOnly}
            />
          </div>
          {!readOnly && (
            <Button
              type="submit"
              className="sm:w-fit"
              disabled={form.formState.isSubmitting || !form.formState.isDirty}
            >
              {form.formState.isSubmitting && <Spinner />}
              {t("save")}
            </Button>
          )}
        </FieldGroup>
      </fieldset>
    </form>
  )
}
