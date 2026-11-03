import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { IntegrationsCatalog } from "@/modules/integrations/components/integrations-catalog"
import { listApiKeys } from "@/modules/integrations/queries"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.sections.integrations")
  return { title: t("title") }
}

export default function IntegrationsPage() {
  const t = useTranslations("settings.sections.integrations")

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<PageSkeleton rows={4} />}>
        <Content />
      </Suspense>
    </>
  )
}

async function Content() {
  const ctx = await getOrgContext()
  const keys = ctx.can("api_keys.manage") ? await listApiKeys(ctx.organizationId) : []
  return <IntegrationsCatalog activeApiKeys={keys.filter((k) => k.status === "active").length} />
}
