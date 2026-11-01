import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { AuthCard } from "@/modules/auth/components/auth-card"
import { RegisterForm } from "@/modules/auth/components/register-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.pages.register")
  return { title: t("title") }
}

export default function RegisterPage() {
  const t = useTranslations("auth.pages.register")

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthCard>
  )
}
