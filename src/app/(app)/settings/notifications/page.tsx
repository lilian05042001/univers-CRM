import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { NotificationSettings } from "@/modules/notifications/components/notification-settings"
import type { NotificationType } from "@/modules/notifications/types"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.sections.notifications")
  return { title: t("title") }
}

export default function NotificationSettingsPage() {
  const t = useTranslations("settings.sections.notifications")

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<PageSkeleton rows={3} />}>
        <Content />
      </Suspense>
    </>
  )
}

async function Content() {
  const ctx = await getOrgContext()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("type")
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", ctx.user.id)
    .eq("in_app", false)
  if (error) throw error
  return <NotificationSettings disabled={data.map((p) => p.type as NotificationType)} />
}
