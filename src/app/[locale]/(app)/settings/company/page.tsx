import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { getOrgContext } from "@/lib/auth/session"
import { CompanySettingsForm } from "@/modules/organizations/components/company-settings-form"
import { getOrganization } from "@/modules/organizations/queries"
import type { CompanySettingsInput } from "@/modules/organizations/schemas"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.sections.company")
  return { title: t("title") }
}

export default function CompanySettingsPage() {
  const t = useTranslations("settings.sections.company")

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Card className="max-w-4xl">
        <CardContent>
          <Suspense fallback={<PageSkeleton rows={3} />}>
            <CompanySettings />
          </Suspense>
        </CardContent>
      </Card>
    </>
  )
}

async function CompanySettings() {
  const ctx = await getOrgContext()
  const org = await getOrganization(ctx.organizationId)

  return (
    <CompanySettingsForm
      readOnly={!ctx.can("settings.manage")}
      defaultValues={{
        name: org.name,
        legalName: org.legal_name ?? "",
        fiscalCode: org.fiscal_code ?? "",
        country: org.country,
        currency: org.currency as CompanySettingsInput["currency"],
        timezone: org.timezone as CompanySettingsInput["timezone"],
        defaultLocale: org.default_locale as CompanySettingsInput["defaultLocale"],
      }}
    />
  )
}
