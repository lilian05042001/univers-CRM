import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { isUuid } from "@/lib/list-params"
import { loadWorkspace } from "@/modules/activity/workspace"
import { ContactDetailView } from "@/modules/contacts/components/contact-detail-view"
import { getContact, getContactDetail } from "@/modules/contacts/queries"
import { getCrmOptions } from "@/modules/crm-config/queries"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contacts.detail")
  return { title: t("title") }
}

export default function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton rows={6} />}>
      <Contact params={params} />
    </Suspense>
  )
}

async function Contact({ params }: Pick<PageProps<"/contacts/[id]">, "params">) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const ctx = await getOrgContext()

  const [contact, record, options, workspace] = await Promise.all([
    getContactDetail(id),
    getContact(id),
    getCrmOptions(ctx.organizationId),
    loadWorkspace({ entity: "contact", id }, ctx),
  ])
  if (!contact || !record) notFound()

  return (
    <ContactDetailView
      contact={contact}
      record={record}
      options={options}
      workspace={workspace}
      can={{ edit: ctx.can("contacts.edit"), delete: ctx.can("contacts.delete") }}
    />
  )
}
