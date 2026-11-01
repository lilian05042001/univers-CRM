"use client"

import { Building2, Mail, Phone, UserRound } from "lucide-react"
import Link from "next/link"
import { useFormatter, useNow, useTranslations } from "next-intl"

import { DetailList } from "@/components/shared/detail-list"
import { StageBadge } from "@/components/shared/stage-badge"
import { TagBadge } from "@/components/shared/tag-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useMoney } from "@/hooks/use-money"
import { formatPhone } from "@/lib/utils/phone"
import { CustomFieldsView } from "@/modules/crm-config/components/custom-fields-view"
import { nameById } from "@/modules/crm-config/options"
import type { CrmOptions } from "@/modules/crm-config/types"

import type { LeadDetail } from "../queries"

/** Secțiunile A (general), B (client) și C (comercial) ale fișei lead-ului. */
export function LeadInfo({ lead, options }: { lead: LeadDetail; options: CrmOptions }) {
  const t = useTranslations("leads.detail")
  const tPriority = useTranslations("leads.priority")
  const format = useFormatter()
  const now = useNow()
  const money = useMoney()
  const memberName = nameById(options.members)
  const dateTime = (v: string | null) =>
    v ? format.dateTime(new Date(v), { dateStyle: "medium", timeStyle: "short" }) : null
  const contacts = [...lead.contacts].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
  const defs = options.customFields.filter((d) => d.entity === "lead")
  const nextDue = lead.next_task_due_at ? new Date(lead.next_task_due_at) : null

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("client")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {contacts.length === 0 && !lead.company && (
            <p className="text-sm text-muted-foreground">{t("noClient")}</p>
          )}
          {contacts.map(({ contact, is_primary }) => {
            const phones = contact.identities.filter((i) => i.type === "phone")
            const emails = contact.identities.filter((i) => i.type === "email")
            return (
              <div key={contact.id} className="flex flex-col gap-1 text-sm">
                <Link
                  href={`/contacts/${contact.id}`}
                  className="flex items-center gap-2 font-medium hover:underline"
                >
                  <UserRound className="size-4 text-muted-foreground" />
                  {contact.full_name}
                  {!is_primary && (
                    <span className="text-xs text-muted-foreground">({t("secondaryContact")})</span>
                  )}
                </Link>
                {contact.position && (
                  <span className="pl-6 text-muted-foreground">{contact.position}</span>
                )}
                {phones.map((p) => (
                  <a
                    key={p.value}
                    href={`tel:${p.value}`}
                    className="flex items-center gap-2 pl-6 text-primary hover:underline"
                  >
                    <Phone className="size-3.5" />
                    {formatPhone(p.value)}
                  </a>
                ))}
                {emails.map((e) => (
                  <a
                    key={e.value}
                    href={`mailto:${e.value}`}
                    className="flex items-center gap-2 pl-6 text-primary hover:underline"
                  >
                    <Mail className="size-3.5" />
                    {e.value}
                  </a>
                ))}
              </div>
            )
          })}
          {lead.company && (
            <Link
              href={`/companies/${lead.company.id}`}
              className="flex items-center gap-2 text-sm font-medium hover:underline"
            >
              <Building2 className="size-4 text-muted-foreground" />
              {lead.company.name}
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("commercial")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <DetailList
            items={[
              {
                label: t("stage"),
                value: <StageBadge name={lead.stage.name} color={lead.stage.color} />,
              },
              { label: t("value"), value: money(Number(lead.value), lead.currency) },
              {
                label: t("wonAmount"),
                value:
                  lead.won_amount !== null ? money(Number(lead.won_amount), lead.currency) : null,
              },
              { label: t("lossReason"), value: lead.loss_reason?.name },
              { label: t("lossComment"), value: lead.loss_comment },
              { label: t("priority"), value: tPriority(lead.priority) },
              {
                label: t("responsible"),
                value: memberName(lead.responsible_id) ?? t("unassigned"),
              },
              { label: t("team"), value: lead.team?.name },
              { label: t("source"), value: lead.source?.name },
              { label: t("created"), value: dateTime(lead.created_at) },
              { label: t("lastActivity"), value: dateTime(lead.last_activity_at) },
              {
                label: t("nextTask"),
                value: nextDue ? (
                  <span className={nextDue < now ? "font-medium text-destructive" : undefined}>
                    {dateTime(lead.next_task_due_at)}
                  </span>
                ) : (
                  t("noTask")
                ),
              },
              { label: t("closed"), value: dateTime(lead.closed_at) },
            ]}
          />
          {lead.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {lead.tags.map(({ tag }) => (
                <TagBadge key={tag.id} name={tag.name} color={tag.color} />
              ))}
            </div>
          )}
          {lead.description && <p className="text-sm whitespace-pre-line">{lead.description}</p>}
        </CardContent>
      </Card>

      {defs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("customFields")}</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomFieldsView defs={defs} values={lead.custom_fields} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
