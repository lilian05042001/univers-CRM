import { useTranslations } from "next-intl"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { moduleMetadata } from "@/lib/i18n/metadata"
import { isUuid, parseListParams } from "@/lib/list-params"
import { getCrmOptions } from "@/modules/crm-config/queries"
import { LeadsView } from "@/modules/leads/components/leads-view"
import { getLead, listLeads } from "@/modules/leads/queries"
import { LEAD_SORT_KEYS } from "@/modules/leads/schemas"

export const generateMetadata = moduleMetadata("leads")

export default function LeadsPage({ searchParams }: PageProps<"/[locale]/leads">) {
  const t = useTranslations()

  return (
    <>
      <PageHeader title={t("nav.leads")} description={t("modules.leads")} />
      <Suspense fallback={<PageSkeleton />}>
        <Leads searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Leads({ searchParams }: Pick<PageProps<"/[locale]/leads">, "searchParams">) {
  const sp = await searchParams
  const params = parseListParams(sp, { sortKeys: LEAD_SORT_KEYS, defaultSort: "created_at" })
  const ctx = await getOrgContext()
  const open = params.get("open")

  const [{ rows, total }, options, record] = await Promise.all([
    listLeads(ctx.organizationId, ctx.user.id, params),
    getCrmOptions(ctx.organizationId),
    isUuid(open) ? getLead(open) : Promise.resolve(null),
  ])

  return (
    <LeadsView
      rows={rows}
      total={total}
      page={params.page}
      pageSize={params.pageSize}
      options={options}
      record={record}
      isNew={open === "new"}
      userId={ctx.user.id}
      can={{
        create: ctx.can("leads.create"),
        edit: ctx.can("leads.edit"),
        delete: ctx.can("leads.delete"),
        export: ctx.can("data.export"),
        assign: ctx.can("leads.assign"),
      }}
    />
  )
}
