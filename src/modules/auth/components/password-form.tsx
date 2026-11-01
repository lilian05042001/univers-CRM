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

import { updatePassword } from "../actions"
import { resetPasswordSchema, type ResetPasswordInput } from "../schemas"

/** Setarea unei parole noi: după link-ul de resetare sau din pagina de profil. */
export function PasswordForm({ redirectTo }: { redirectTo?: string }) {
  const t = useTranslations("auth")
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  async function onSubmit(values: ResetPasswordInput) {
    setError(null)
    const result = await updatePassword(values)
    if (!result.ok) {
      setError(applyActionResult(form, result))
      return
    }
    toast.success(t("passwordUpdated"))
    form.reset()
    if (redirectTo) router.push(redirectTo)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <FormError error={error} />
        <TextField
          control={form.control}
          name="password"
          label={t("newPassword")}
          type="password"
          autoComplete="new-password"
          description={t("passwordHint")}
        />
        <TextField
          control={form.control}
          name="confirmPassword"
          label={t("confirmPassword")}
          type="password"
          autoComplete="new-password"
        />
        <Button type="submit" disabled={form.formState.isSubmitting} className="sm:w-fit">
          {form.formState.isSubmitting && <Spinner />}
          {t("savePassword")}
        </Button>
      </FieldGroup>
    </form>
  )
}
