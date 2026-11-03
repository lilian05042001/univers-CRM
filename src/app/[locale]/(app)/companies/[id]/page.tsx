import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { isUuid } from "@/lib/list-params"
import { loadWorkspace } from "@/modules/activity/workspace"
import { CompanyDetailView } from "@/modules/companies/components/company-detail-view"
import { getCompany, getCompanyDetail } from "@/modules/companies/queries"
import { getCrmOptions } from "@/modules/crm-config/queries"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("companies.detail")
  return { title: t("title") }
}

export default function CompanyPage({ params }: PageProps<"/[locale]/companies/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton rows={6} />}>
      <Company params={params} />
    </Suspense>
  )
}

async function Company({ params }: Pick<PageProps<"/[locale]/companies/[id]">, "params">) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const ctx = await getOrgContext()

  const [company, record, options, workspace] = await Promise.all([
    getCompanyDetail(id),
    getCompany(id),
    getCrmOptions(ctx.organizationId),
    loadWorkspace({ entity: "company", id }, ctx),
  ])
  if (!company || !record) notFound()

  return (
    <CompanyDetailView
      company={company}
      record={record}
      options={options}
      workspace={workspace}
      can={{ edit: ctx.can("contacts.edit"), delete: ctx.can("contacts.delete") }}
    />
  )
}
