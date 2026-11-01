import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"

import { AuthCard } from "@/modules/auth/components/auth-card"
import { PasswordForm } from "@/modules/auth/components/password-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.pages.resetPassword")
  return { title: t("title") }
}

// Accesibilă doar cu sesiune (creată de link-ul de resetare prin /auth/callback).
export default function ResetPasswordPage() {
  const t = useTranslations("auth.pages.resetPassword")

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <PasswordForm redirectTo="/dashboard" />
    </AuthCard>
  )
}
