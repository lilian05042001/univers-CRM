import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { RolesList } from "@/modules/team/components/roles-list"
import { listRoles } from "@/modules/team/queries"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.sections.roles")
  return { title: t("title") }
}

export default function RolesPage() {
  const t = useTranslations("settings.sections.roles")

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<PageSkeleton rows={3} />}>
        <Roles />
      </Suspense>
    </>
  )
}

async function Roles() {
  const ctx = await getOrgContext()
  const roles = await listRoles(ctx.organizationId)
  return <RolesList roles={roles} canManage={ctx.can("roles.manage")} />
}
