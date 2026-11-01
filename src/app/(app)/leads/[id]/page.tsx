import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { isUuid } from "@/lib/list-params"
import { loadWorkspace } from "@/modules/activity/workspace"
import { getCrmOptions } from "@/modules/crm-config/queries"
import { LeadDetailView } from "@/modules/leads/components/lead-detail-view"
import { getLead, getLeadDetail } from "@/modules/leads/queries"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("leads.detail")
  return { title: t("title") }
}

export default function LeadPage({ params }: PageProps<"/leads/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton rows={6} />}>
      <Lead params={params} />
    </Suspense>
  )
}

async function Lead({ params }: Pick<PageProps<"/leads/[id]">, "params">) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const ctx = await getOrgContext()

  const [lead, record, options, workspace] = await Promise.all([
    getLeadDetail(id),
    getLead(id),
    getCrmOptions(ctx.organizationId),
    loadWorkspace({ entity: "lead", id }, ctx),
  ])
  // Lead inexistent, șters sau invizibil utilizatorului (RLS) → 404, fără a confirma existența.
  if (!lead || !record) notFound()

  return (
    <LeadDetailView
      lead={lead}
      record={record}
      options={options}
      workspace={workspace}
      can={{
        edit: ctx.can("leads.edit"),
        assign: ctx.can("leads.assign"),
        delete: ctx.can("leads.delete"),
      }}
    />
  )
}
