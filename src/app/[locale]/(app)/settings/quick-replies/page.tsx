import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { QuickRepliesSettings } from "@/modules/inbox/components/quick-replies-settings"
import { listQuickReplies } from "@/modules/inbox/queries"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.sections.quickReplies")
  return { title: t("title") }
}

export default function QuickRepliesPage() {
  const t = useTranslations("settings.sections.quickReplies")

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<PageSkeleton rows={6} />}>
        <Content />
      </Suspense>
    </>
  )
}

async function Content() {
  const ctx = await getOrgContext()
  const replies = await listQuickReplies(ctx.organizationId)
  return (
    <QuickRepliesSettings
      replies={replies}
      currentUserId={ctx.user.id}
      canManageShared={ctx.can("settings.manage")}
    />
  )
}
