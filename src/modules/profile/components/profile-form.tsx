"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormError } from "@/components/shared/form/form-error"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { applyActionResult } from "@/lib/actions/apply-result"

import { updateProfile } from "../actions"
import { profileSchema, type ProfileInput } from "../schemas"

export function ProfileForm({
  defaultValues,
  email,
}: {
  defaultValues: ProfileInput
  email: string
}) {
  const t = useTranslations("profile")
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<ProfileInput>({ resolver: zodResolver(profileSchema), defaultValues })

  async function onSubmit(values: ProfileInput) {
    setError(null)
    const result = await updateProfile(values)
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
      <FieldGroup>
        <FormError error={error} />
        <div className="grid gap-6 md:grid-cols-2">
          <TextField
            control={form.control}
            name="fullName"
            label={t("fullName")}
            autoComplete="name"
          />
          <TextField
            control={form.control}
            name="phone"
            label={t("phone")}
            type="tel"
            autoComplete="tel"
          />
        </div>
        <p className="text-sm text-muted-foreground">{t("emailInfo", { email })}</p>
        <Button
          type="submit"
          className="sm:w-fit"
          disabled={form.formState.isSubmitting || !form.formState.isDirty}
        >
          {form.formState.isSubmitting && <Spinner />}
          {t("save")}
        </Button>
      </FieldGroup>
    </form>
  )
}
