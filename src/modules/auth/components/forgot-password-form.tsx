"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheck } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { FormError } from "@/components/shared/form/form-error"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { applyActionResult } from "@/lib/actions/apply-result"

import { requestPasswordReset } from "../actions"
import { forgotPasswordSchema, type ForgotPasswordInput } from "../schemas"

export function ForgotPasswordForm() {
  const t = useTranslations("auth")
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  async function onSubmit(values: ForgotPasswordInput) {
    setError(null)
    const result = await requestPasswordReset(values)
    if (result.ok) setSent(true)
    else setError(applyActionResult(form, result))
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <MailCheck className="size-10 text-success" />
        <p className="text-sm text-muted-foreground">{t("resetSent")}</p>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          {t("backToLogin")}
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <FormError error={error} />
        <TextField
          control={form.control}
          name="email"
          label={t("email")}
          type="email"
          autoComplete="email"
          autoFocus
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          {t("sendResetLink")}
        </Button>
        <Link href="/login" className="text-center text-sm text-primary hover:underline">
          {t("backToLogin")}
        </Link>
      </FieldGroup>
    </form>
  )
}
