import { useTranslations } from "next-intl"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { moduleMetadata } from "@/lib/i18n/metadata"
import { canReadAutomations } from "@/modules/automations/access"
import { AutomationsView } from "@/modules/automations/components/automations-view"
import { NoAccess } from "@/modules/automations/components/no-access"
import { listAutomations } from "@/modules/automations/queries"

export const generateMetadata = moduleMetadata("automations")

export default function AutomationsPage() {
  const t = useTranslations()

  return (
    <>
      <PageHeader title={t("nav.automations")} description={t("modules.automations")} />
      <Suspense fallback={<PageSkeleton />}>
        <Automations />
      </Suspense>
    </>
  )
}

async function Automations() {
  const ctx = await getOrgContext()
  if (!canReadAutomations(ctx)) return <NoAccess />
  const automations = await listAutomations(ctx.organizationId)
  return <AutomationsView automations={automations} canManage={ctx.can("automations.manage")} />
}
