import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { getEditorOptions } from "@/modules/automations/access"
import { AutomationEditor } from "@/modules/automations/components/automation-editor"
import { NoAccess } from "@/modules/automations/components/no-access"
import { toFormValues } from "@/modules/automations/mapping"
import { TEMPLATE_KEYS, templateValues, type TemplateKey } from "@/modules/automations/templates"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("automations")
  return { title: t("createTitle") }
}

export default function NewAutomationPage({ searchParams }: PageProps<"/automations/new">) {
  const t = useTranslations("automations")

  return (
    <>
      <PageHeader title={t("createTitle")} />
      <Suspense fallback={<PageSkeleton />}>
        <Editor searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Editor({ searchParams }: Pick<PageProps<"/automations/new">, "searchParams">) {
  const ctx = await getOrgContext()
  if (!ctx.can("automations.manage")) return <NoAccess />
  const { template } = await searchParams
  const [options, t] = await Promise.all([
    getEditorOptions(ctx.organizationId),
    getTranslations("automations.templates"),
  ])
  const initial = (TEMPLATE_KEYS as readonly unknown[]).includes(template)
    ? templateValues(template as TemplateKey, options, (key) => t(key))
    : toFormValues(null)
  return <AutomationEditor initial={initial} options={options} canManage />
}
