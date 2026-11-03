import { useTranslations } from "next-intl"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { moduleMetadata } from "@/lib/i18n/metadata"
import { isUuid, parseListParams } from "@/lib/list-params"
import { ContactsView } from "@/modules/contacts/components/contacts-view"
import { getContact, listContacts } from "@/modules/contacts/queries"
import { CONTACT_SORT_KEYS } from "@/modules/contacts/schemas"
import { getCrmOptions } from "@/modules/crm-config/queries"

export const generateMetadata = moduleMetadata("contacts")

export default function ContactsPage({ searchParams }: PageProps<"/[locale]/contacts">) {
  const t = useTranslations()

  return (
    <>
      <PageHeader title={t("nav.contacts")} description={t("modules.contacts")} />
      <Suspense fallback={<PageSkeleton />}>
        <Contacts searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Contacts({ searchParams }: Pick<PageProps<"/[locale]/contacts">, "searchParams">) {
  const sp = await searchParams
  const params = parseListParams(sp, { sortKeys: CONTACT_SORT_KEYS, defaultSort: "created_at" })
  const ctx = await getOrgContext()
  const open = params.get("open")

  const [{ rows, total }, options, record] = await Promise.all([
    listContacts(ctx.organizationId, params),
    getCrmOptions(ctx.organizationId),
    isUuid(open) ? getContact(open) : Promise.resolve(null),
  ])

  return (
    <ContactsView
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
