"use client"

import { zodResolver } from "@hookform/resolvers/zod"
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

import { login } from "../actions"
import { loginSchema, type LoginInput } from "../schemas"

export function LoginForm() {
  const t = useTranslations("auth")
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? undefined
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "link" ? "errors.auth.invalidLink" : null
  )

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: searchParams.get("email") ?? "", password: "", next },
  })

  async function onSubmit(values: LoginInput) {
    setError(null)
    // La succes acțiunea face redirect, deci rezultatul există doar la eroare.
    const result = await login(values)
    setError(applyActionResult(form, result))
  }

  const registerHref = next ? `/register?next=${encodeURIComponent(next)}` : "/register"

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
        <TextField
          control={form.control}
          name="password"
          label={t("password")}
          type="password"
          autoComplete="current-password"
        />
        <div className="-mt-3 text-right text-sm">
          <Link href="/forgot-password" className="text-primary hover:underline">
            {t("forgotPassword")}
          </Link>
        </div>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner />}
          {t("signIn")}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href={registerHref} className="font-medium text-primary hover:underline">
            {t("signUp")}
          </Link>
        </p>
      </FieldGroup>
    </form>
  )
}
