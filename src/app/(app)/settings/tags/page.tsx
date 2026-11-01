import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { TagsSettings } from "@/modules/crm-config/components/tags-settings"
import { getCrmOptions } from "@/modules/crm-config/queries"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.sections.tags")
  return { title: t("title") }
}

export default function Page() {
  const t = useTranslations("settings.sections.tags")

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
  const { tags } = await getCrmOptions(ctx.organizationId)
  return <TagsSettings tags={tags} canManage={ctx.can("settings.manage")} />
}
