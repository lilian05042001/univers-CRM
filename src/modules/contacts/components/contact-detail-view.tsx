"use client"

import { Mail, Phone } from "lucide-react"
import Link from "next/link"
import { useFormatter, useTranslations } from "next-intl"

import { DetailList } from "@/components/shared/detail-list"
import { RecordHeader } from "@/components/shared/record-header"
import { RelatedLeads } from "@/components/shared/related-leads"
import { TagBadge } from "@/components/shared/tag-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouteDialog } from "@/hooks/use-route-dialog"
import { formatPhone } from "@/lib/utils/phone"
import { RecordWorkspace } from "@/modules/activity/components/record-workspace"
import type { WorkspaceData } from "@/modules/activity/workspace"
import { CustomFieldsView } from "@/modules/crm-config/components/custom-fields-view"
import { nameById } from "@/modules/crm-config/options"
import type { CrmOptions } from "@/modules/crm-config/types"

import { deleteContacts } from "../actions"
import type { ContactDetail, ContactRecord } from "../queries"

import { ContactFormDialog } from "./contact-form-dialog"

export function ContactDetailView({
  contact,
  record,
  options,
  workspace,
  can,
}: {
  contact: ContactDetail
  record: ContactRecord
  options: CrmOptions
  workspace: WorkspaceData
  can: { edit: boolean; delete: boolean }
}) {
  const t = useTranslations("contacts.detail")
  const format = useFormatter()
  const routeDialog = useRouteDialog()
  const memberName = nameById(options.members)
  const address = (contact.address ?? {}) as { city?: string; street?: string }
  const phones = contact.identities.filter((i) => i.type === "phone")
  const emails = contact.identities.filter((i) => i.type === "email")
  const defs = options.customFields.filter((d) => d.entity === "contact")
  const leads = contact.leads
    .filter((l) => !l.lead.deleted_at)
    .map(({ lead }) => ({ ...lead, value: Number(lead.value) }))

  return (
    <>
      <RecordHeader
        backHref="/contacts"
        backLabel={t("back")}
        title={contact.full_name ?? ""}
        subtitle={
          <>
            {contact.position}
            {contact.position && contact.company && " · "}
            {contact.company && (
              <Link href={`/companies/${contact.company.id}`} className="hover:underline">
                {contact.company.name}
              </Link>
            )}
          </>
        }
        canEdit={can.edit}
        canDelete={can.delete}
        onDelete={() => deleteContacts({ ids: [contact.id] })}
        deleteDescription={t("deleteDescription", { name: contact.full_name ?? "" })}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("info")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 text-sm">
                {phones.map((p) => (
                  <a
                    key={p.value}
                    href={`tel:${p.value}`}
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Phone className="size-3.5" />
                    {formatPhone(p.value)}
                  </a>
                ))}
                {emails.map((e) => (
                  <a
                    key={e.value}
                    href={`mailto:${e.value}`}
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Mail className="size-3.5" />
                    {e.value}
                  </a>
                ))}
              </div>
              <DetailList
                items={[
                  {
                    label: t("address"),
                    value: [address.street, address.city].filter(Boolean).join(", "),
                  },
                  { label: t("source"), value: contact.source?.name },
                  { label: t("owner"), value: memberName(contact.owner_id) ?? t("unassigned") },
                  {
                    label: t("created"),
                    value: format.dateTime(new Date(contact.created_at), { dateStyle: "medium" }),
                  },
                ]}
              />
              {contact.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map(({ tag }) => (
                    <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                  ))}
                </div>
              )}
              {defs.length > 0 && <CustomFieldsView defs={defs} values={contact.custom_fields} />}
            </CardContent>
          </Card>
          <RelatedLeads leads={leads} />
        </div>
        <RecordWorkspace data={workspace} />
      </div>
      {routeDialog.openParam === "edit" && can.edit && (
        <ContactFormDialog
          record={record}
          options={options}
          canMerge={can.delete}
          onClose={routeDialog.close}
        />
      )}
    </>
  )
}
