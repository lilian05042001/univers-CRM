import { useTranslations } from "next-intl"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { moduleMetadata } from "@/lib/i18n/metadata"
import { isUuid, parseListParams } from "@/lib/list-params"
import { CompaniesView } from "@/modules/companies/components/companies-view"
import { getCompany, listCompanies } from "@/modules/companies/queries"
import { COMPANY_SORT_KEYS } from "@/modules/companies/schemas"
import { getCrmOptions } from "@/modules/crm-config/queries"

export const generateMetadata = moduleMetadata("companies")

export default function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  const t = useTranslations()

  return (
    <>
      <PageHeader title={t("nav.companies")} description={t("modules.companies")} />
      <Suspense fallback={<PageSkeleton />}>
        <Companies searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Companies({ searchParams }: Pick<PageProps<"/companies">, "searchParams">) {
  const sp = await searchParams
  const params = parseListParams(sp, { sortKeys: COMPANY_SORT_KEYS, defaultSort: "created_at" })
  const ctx = await getOrgContext()
  const open = params.get("open")

  const [{ rows, total }, options, record] = await Promise.all([
    listCompanies(ctx.organizationId, params),
    getCrmOptions(ctx.organizationId),
    isUuid(open) ? getCompany(open) : Promise.resolve(null),
  ])

  return (
    <CompaniesView
      rows={rows}
      total={total}
      page={params.page}
      pageSize={params.pageSize}
      options={options}
      record={record}
      isNew={open === "new"}
      can={{
        create: ctx.can("contacts.create"),
        edit: ctx.can("contacts.edit"),
        delete: ctx.can("contacts.delete"),
        export: ctx.can("data.export"),
      }}
    />
  )
}
