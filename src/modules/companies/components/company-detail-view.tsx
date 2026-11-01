"use client"

import { Globe, Mail, Phone, UserRound } from "lucide-react"
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

import { deleteCompanies } from "../actions"
import type { CompanyDetail, CompanyRecord } from "../queries"

import { CompanyFormDialog } from "./company-form-dialog"

export function CompanyDetailView({
  company,
  record,
  options,
  workspace,
  can,
}: {
  company: CompanyDetail
  record: CompanyRecord
  options: CrmOptions
  workspace: WorkspaceData
  can: { edit: boolean; delete: boolean }
}) {
  const t = useTranslations("companies.detail")
  const format = useFormatter()
  const routeDialog = useRouteDialog()
  const memberName = nameById(options.members)
  const address = (company.address ?? {}) as { city?: string; street?: string }
  const defs = options.customFields.filter((d) => d.entity === "company")
  const contacts = company.contacts.filter((c) => !c.deleted_at)
  const leads = company.leads
    .filter((l) => !l.deleted_at)
    .map((l) => ({ ...l, value: Number(l.value) }))

  return (
    <>
      <RecordHeader
        backHref="/companies"
        backLabel={t("back")}
        title={company.name}
        subtitle={company.industry}
        canEdit={can.edit}
        canDelete={can.delete}
        onDelete={() => deleteCompanies({ ids: [company.id] })}
        deleteDescription={t("deleteDescription", { name: company.name })}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("info")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 text-sm">
                {company.phone && (
                  <a
                    href={`tel:${company.phone}`}
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Phone className="size-3.5" />
                    {formatPhone(company.phone)}
                  </a>
                )}
                {company.email && (
                  <a
                    href={`mailto:${company.email}`}
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Mail className="size-3.5" />
                    {company.email}
                  </a>
                )}
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Globe className="size-3.5" />
                    {company.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
              </div>
              <DetailList
                items={[
                  {
                    label: t("address"),
                    value: [address.street, address.city].filter(Boolean).join(", "),
                  },
                  { label: t("owner"), value: memberName(company.owner_id) ?? t("unassigned") },
                  {
                    label: t("created"),
                    value: format.dateTime(new Date(company.created_at), { dateStyle: "medium" }),
                  },
                ]}
              />
              {company.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {company.tags.map(({ tag }) => (
                    <TagBadge key={tag.id} name={tag.name} color={tag.color} />
                  ))}
                </div>
              )}
              {defs.length > 0 && <CustomFieldsView defs={defs} values={company.custom_fields} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("contacts", { count: contacts.length })}</CardTitle>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noContacts")}</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {contacts.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/contacts/${c.id}`}
                        className="flex items-center gap-2 font-medium hover:underline"
                      >
                        <UserRound className="size-4 text-muted-foreground" />
                        {c.full_name}
                      </Link>
                      {c.position && (
                        <span className="pl-6 text-muted-foreground">{c.position}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <RelatedLeads leads={leads} />
        </div>
        <RecordWorkspace data={workspace} conversations={false} />
      </div>
      {routeDialog.openParam === "edit" && can.edit && (
        <CompanyFormDialog record={record} options={options} onClose={routeDialog.close} />
      )}
    </>
  )
}
