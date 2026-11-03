import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { AuthCard } from "@/modules/auth/components/auth-card"
import { ForgotPasswordForm } from "@/modules/auth/components/forgot-password-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.pages.forgotPassword")
  return { title: t("title") }
}

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.pages.forgotPassword")

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthCard>
  )
}
