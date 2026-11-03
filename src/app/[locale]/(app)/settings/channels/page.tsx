import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { env } from "@/lib/env"
import { ChannelsSettings } from "@/modules/inbox/components/channels-settings"
import { listChannels } from "@/modules/inbox/queries"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.sections.channels")
  return { title: t("title") }
}

export default function ChannelsPage() {
  const t = useTranslations("settings.sections.channels")

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
  const channels = await listChannels(ctx.organizationId)
  return (
    <ChannelsSettings
      channels={channels}
      webhookBaseUrl={`${env.appUrl}/api/webhooks`}
      canManage={ctx.can("settings.manage")}
    />
  )
}
