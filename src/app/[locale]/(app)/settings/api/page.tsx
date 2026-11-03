import { Lock } from "lucide-react"
import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { env } from "@/lib/env"
import { ApiKeysSettings } from "@/modules/integrations/components/api-keys-settings"
import { ApiReference } from "@/modules/integrations/components/api-reference"
import { listApiKeys } from "@/modules/integrations/queries"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.sections.api")
  return { title: t("title") }
}

export default function ApiPage() {
  const t = useTranslations("settings.sections.api")

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
  if (!ctx.can("api_keys.manage")) return <NoAccess />
  const keys = await listApiKeys(ctx.organizationId)
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <ApiKeysSettings keys={keys} canManage />
      <ApiReference baseUrl={`${env.appUrl}/api/v1`} />
    </div>
  )
}

function NoAccess() {
  const t = useTranslations("integrations")
  return <EmptyState icon={Lock} title={t("noAccessTitle")} description={t("noAccessHint")} />
}
