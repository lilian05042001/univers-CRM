import { MessagesSquare } from "lucide-react"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { cn } from "cn"

import { getOrgContext } from "@/lib/auth/session"
import { isUuid, parseListParams, type SearchParams } from "@/lib/list-params"
import { getCrmOptions } from "@/modules/crm-config/queries"

import {
  INBOX_MAX,
  INBOX_PAGE,
  getConversation,
  listChannels,
  listContactOpenLeads,
  listConversations,
  listMessages,
  listQuickReplies,
  type InboxFilters,
} from "../queries"
import {
  ASSIGNMENT_FILTERS,
  STATUS_FILTERS,
  type AssignmentFilter,
  type StatusFilter,
} from "../schemas"

import { ConversationList } from "./conversation-list"
import { ConversationThread } from "./conversation-thread"
import { CustomerPanel } from "./customer-panel"

function parseFilters(searchParams: SearchParams): InboxFilters {
  const params = parseListParams(searchParams, {
    sortKeys: ["last_message_at"] as const,
    defaultSort: "last_message_at",
  })
  const status = params.get("status")
  const assignment = params.get("assign")
  const limit = Math.trunc(Number(params.get("limit"))) || INBOX_PAGE
  return {
    status: (STATUS_FILTERS as readonly string[]).includes(status)
      ? (status as StatusFilter)
      : "open",
    assignment: (ASSIGNMENT_FILTERS as readonly string[]).includes(assignment)
      ? (assignment as AssignmentFilter)
      : "all",
    channelId: isUuid(params.get("channel")) ? params.get("channel") : "",
    tagId: isUuid(params.get("tag")) ? params.get("tag") : "",
    q: params.q,
    limit: Math.min(Math.max(limit, INBOX_PAGE), INBOX_MAX),
  }
}

/**
 * Inbox pe 3 coloane: lista conversațiilor · firul mesajelor · fișa clientului.
 * Pe telefon se vede o coloană odată; fișa clientului e un panou lateral sub 1280px.
 */
export async function InboxScreen({
  searchParams,
  conversationId,
}: {
  searchParams: SearchParams
  conversationId: string | null
}) {
  if (conversationId !== null && !isUuid(conversationId)) notFound()
  const t = await getTranslations("inbox")
  const ctx = await getOrgContext()
  const filters = parseFilters(searchParams)

  const [list, options, channels, quickReplies, conversation, messages] = await Promise.all([
    listConversations(ctx.organizationId, ctx.user.id, filters),
    getCrmOptions(ctx.organizationId),
    listChannels(ctx.organizationId),
    listQuickReplies(ctx.organizationId),
    conversationId ? getConversation(conversationId) : null,
    conversationId ? listMessages(conversationId) : [],
  ])
  // Conversație inexistentă sau invizibilă utilizatorului (RLS) → 404, fără a confirma existența.
  if (conversationId && !conversation) notFound()
  const openLeads =
    conversation?.contact && !conversation.lead
      ? await listContactOpenLeads(conversation.contact.id)
      : []

  const panel = conversation && (
    <CustomerPanel
      conversation={conversation}
      openLeads={openLeads}
      tags={options.tags}
      canCreateLead={ctx.can("leads.create")}
    />
  )

  return (
    <div className="-mx-4 -my-6 grid h-[calc(100svh-3.5rem)] md:-mx-6 lg:-mx-8 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)_18rem]">
      <div
        className={cn("flex min-h-0 flex-col border-r bg-card", conversation && "max-lg:hidden")}
      >
        <ConversationList
          items={list.items}
          hasMore={list.hasMore}
          limit={filters.limit}
          activeId={conversationId}
          organizationId={ctx.organizationId}
          channels={channels}
          tags={options.tags}
          members={options.members}
        />
      </div>

      {conversation ? (
        <>
          <ConversationThread
            conversation={conversation}
            messages={messages}
            quickReplies={quickReplies}
            members={options.members}
            currentUserId={ctx.user.id}
            canAssign={ctx.can("inbox.assign")}
            timeZone={ctx.membership.organization.timezone}
            unread={list.items.find((c) => c.id === conversation.id)?.unread ?? 0}
            panel={panel}
          />
          <aside
            className="min-h-0 overflow-y-auto border-l bg-card p-4 max-xl:hidden"
            aria-label={t("panel.title")}
          >
            {panel}
          </aside>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground max-lg:hidden">
          <MessagesSquare className="size-10" />
          <p className="font-medium">{t("selectTitle")}</p>
          <p className="max-w-sm text-sm">{t("selectHint")}</p>
        </div>
      )}
    </div>
  )
}
