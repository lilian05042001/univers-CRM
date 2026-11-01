import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { AuthCard } from "@/modules/auth/components/auth-card"
import { LoginForm } from "@/modules/auth/components/login-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.pages.login")
  return { title: t("title") }
}

export default function LoginPage() {
  const t = useTranslations("auth.pages.login")

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  )
}
