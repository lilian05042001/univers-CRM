import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"

import { AuthCard } from "@/modules/auth/components/auth-card"
import { AuthShell } from "@/modules/auth/components/auth-shell"
import { CreateOrganizationForm } from "@/modules/organizations/components/create-organization-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding")
  return { title: t("title") }
}

// Accesibilă doar autentificat (proxy.ts). Folosită și pentru crearea unei organizații suplimentare.
export default function OnboardingPage() {
  const t = useTranslations("onboarding")

  return (
    <AuthShell>
      <AuthCard title={t("title")} description={t("description")}>
        <CreateOrganizationForm />
      </AuthCard>
    </AuthShell>
  )
}
