import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { getCrmOptions } from "@/modules/crm-config/queries"
import { PipelinesSettings } from "@/modules/pipeline/components/pipelines-settings"
import { listAssignmentRules } from "@/modules/pipeline/queries"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.sections.pipelines")
  return { title: t("title") }
}

export default function PipelinesSettingsPage({ searchParams }: PageProps<"/settings/pipelines">) {
  const t = useTranslations("settings.sections.pipelines")

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<PageSkeleton rows={6} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Content({ searchParams }: Pick<PageProps<"/settings/pipelines">, "searchParams">) {
  const t = await getTranslations("errors")
  const { pipeline } = await searchParams
  const ctx = await getOrgContext()
  if (!ctx.can("pipelines.manage")) return <p className="text-muted-foreground">{t("forbidden")}</p>

  const [options, rules] = await Promise.all([
    getCrmOptions(ctx.organizationId),
    listAssignmentRules(ctx.organizationId),
  ])
  const selectedId =
    (typeof pipeline === "string" && options.pipelines.find((p) => p.id === pipeline)?.id) ||
    options.pipelines.find((p) => p.isDefault)?.id ||
    options.pipelines[0]!.id

  return (
    <PipelinesSettings
      pipelines={options.pipelines}
      rules={rules}
      members={options.members}
      selectedId={selectedId}
    />
  )
}
