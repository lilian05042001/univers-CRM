import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { isUuid } from "@/lib/list-params"
import { canReadAutomations, getEditorOptions } from "@/modules/automations/access"
import { AutomationEditor } from "@/modules/automations/components/automation-editor"
import { NoAccess } from "@/modules/automations/components/no-access"
import { toFormValues } from "@/modules/automations/mapping"
import { getAutomation } from "@/modules/automations/queries"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav")
  return { title: t("automations") }
}

export default function AutomationPage({ params }: PageProps<"/automations/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Editor params={params} />
    </Suspense>
  )
}

async function Editor({ params }: Pick<PageProps<"/automations/[id]">, "params">) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const ctx = await getOrgContext()
  if (!canReadAutomations(ctx)) return <NoAccess />
  const [automation, options] = await Promise.all([
    getAutomation(id),
    getEditorOptions(ctx.organizationId),
  ])
  if (!automation) notFound()

  return (
    <>
      <PageHeader title={automation.name} />
      <AutomationEditor
        initial={toFormValues(automation)}
        options={options}
        canManage={ctx.can("automations.manage")}
      />
    </>
  )
}
