"use client"

import { Mail, Phone, Target, UserRound, X } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { StageBadge } from "@/components/shared/stage-badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useMoney } from "@/hooks/use-money"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import { formatPhone } from "@/lib/utils/phone"
import type { NamedOption, TagOption } from "@/modules/crm-config/types"

import { linkConversationLead } from "../actions"
import type { ConversationDetail } from "../queries"

import { ConversationTags } from "./conversation-tags"
import { CreateLeadDialog } from "./create-lead-dialog"

/** Fișa clientului din Inbox: contact, lead asociat (sau lead nou), etichete. */
export function CustomerPanel({
  conversation,
  openLeads,
  tags,
  canCreateLead,
}: {
  conversation: ConversationDetail
  openLeads: NamedOption[]
  tags: TagOption[]
  canCreateLead: boolean
}) {
  const t = useTranslations("inbox.panel")
  const money = useMoney()
  const { run, pending } = useActionRunner()
  const contact = conversation.contact?.deleted_at ? null : conversation.contact
  const lead = conversation.lead?.deleted_at ? null : conversation.lead
  const linkLead = (leadId: string | null) =>
    run(() => linkConversationLead({ id: conversation.id, leadId }), "inbox.panel.leadLinked")

  return (
    <div className="flex flex-col gap-6 text-sm">
      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase">{t("contact")}</h3>
        {contact ? (
          <>
            <Link
              href={`/contacts/${contact.id}`}
              className="flex items-center gap-2 font-medium hover:underline"
            >
              <UserRound className="size-4 text-muted-foreground" />
              {contact.full_name}
            </Link>
            {(contact.position || contact.company) && (
              <p className="text-muted-foreground">
                {[contact.position, contact.company?.name].filter(Boolean).join(" · ")}
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {contact.identities.map((identity) => (
                <li
                  key={`${identity.type}:${identity.value}`}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  {identity.type === "email" ? (
                    <Mail className="size-3.5" />
                  ) : (
                    <Phone className="size-3.5" />
                  )}
                  <span className="truncate">
                    {identity.type === "email" ? identity.value : formatPhone(identity.value)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted-foreground">{t("noContact")}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase">{t("lead")}</h3>
        {lead ? (
          <div className="flex items-start gap-2 rounded-md border p-2">
            <Target className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/leads/${lead.id}`}
                className="block truncate font-medium hover:underline"
              >
                {lead.title}
              </Link>
              <StageBadge name={lead.stage.name} color={lead.stage.color} />
              <p className="text-muted-foreground">{money(Number(lead.value), lead.currency)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("unlinkLead")}
              disabled={pending}
              onClick={() => linkLead(null)}
            >
              <X />
            </Button>
          </div>
        ) : (
          <>
            {openLeads.length > 0 && (
              <Select disabled={pending} onValueChange={(id) => linkLead(id)}>
                <SelectTrigger className="w-full" aria-label={t("linkLead")}>
                  <SelectValue placeholder={t("linkLead")} />
                </SelectTrigger>
                <SelectContent>
                  {openLeads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {canCreateLead && (
              <CreateLeadDialog
                conversationId={conversation.id}
                defaultTitle={contact?.full_name ?? conversation.display_name}
              />
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-muted-foreground uppercase">{t("tags")}</h3>
        <ConversationTags
          conversationId={conversation.id}
          selected={conversation.tags.map((tag) => tag.tag_id)}
          tags={tags}
        />
      </section>
    </div>
  )
}
