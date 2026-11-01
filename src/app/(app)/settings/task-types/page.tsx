import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { TaskTypesSettings } from "@/modules/crm-config/components/task-types-settings"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.sections.taskTypes")
  return { title: t("title") }
}

export default function TaskTypesPage() {
  const t = useTranslations("settings.sections.taskTypes")

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
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("task_types")
    .select("id, name, icon, is_system")
    .eq("organization_id", ctx.organizationId)
    .order("position")
  if (error) throw error
  return <TaskTypesSettings types={data} canManage={ctx.can("settings.manage")} />
}
