"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheck } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { FormError } from "@/components/shared/form/form-error"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { applyActionResult } from "@/lib/actions/apply-result"

import { register } from "../actions"
import { registerSchema, type RegisterInput } from "../schemas"

export function RegisterForm() {
  const t = useTranslations("auth")
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? undefined
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: "", email: searchParams.get("email") ?? "", password: "", next },
  })

  async function onSubmit(values: RegisterInput) {
    setError(null)
    const result = await register(values)
    if (result.ok) setSentTo(values.email)
    else setError(applyActionResult(form, result))
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <MailCheck className="size-10 text-success" />
        <p className="font-medium">{t("checkEmailTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("checkEmailText", { email: sentTo })}</p>
      </div>
    )
  }

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login"

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <FormError error={error} />
        <TextField
          control={form.control}
          name="fullName"
          label={t("fullName")}
          autoComplete="name"
          autoFocus
        />
        <TextField
          control={form.control}
          name="email"
          label={t("email")}
          type="email"
          autoComplete="email"
        />
        <TextField
          control={form.control}
          name="password"
          label={t("password")}
          type="password"
          autoComplete="new-password"
          description={t("passwordHint")}
        />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          {t("createAccount")}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t("haveAccount")}{" "}
          <Link href={loginHref} className="font-medium text-primary hover:underline">
            {t("signIn")}
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
