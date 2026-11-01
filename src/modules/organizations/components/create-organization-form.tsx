"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { FormError } from "@/components/shared/form/form-error"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { applyActionResult } from "@/lib/actions/apply-result"

import { createOrganization } from "../actions"
import { createOrganizationSchema, type CreateOrganizationInput } from "../schemas"

export function CreateOrganizationForm() {
  const t = useTranslations("onboarding")
  const [error, setError] = useState<string | null>(null)

  const form = useForm<CreateOrganizationInput>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: "" },
  })

  async function onSubmit(values: CreateOrganizationInput) {
    setError(null)
    const result = await createOrganization(values)
    setError(applyActionResult(form, result))
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <FormError error={error} />
        <TextField
          control={form.control}
          name="name"
          label={t("companyName")}
          placeholder={t("companyNamePlaceholder")}
          autoComplete="organization"
          autoFocus
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          {t("create")}
        </Button>
      </FieldGroup>
    </form>
  )
}
