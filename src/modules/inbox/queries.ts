import "server-only"

import type { RecordRef } from "@/lib/crm/record-ref"
import { idsWithTag, searchFilter } from "@/lib/crm/records"
import { createClient } from "@/lib/supabase/server"
import type { ChannelProvider } from "@/lib/channels/types"
import type { StageKind, TagOption } from "@/modules/crm-config/types"

import type { AssignmentFilter, ConversationStatus, StatusFilter } from "./schemas"

export const INBOX_PAGE = 50
export const INBOX_MAX = 500

export type ConversationListItem = {
  id: string
  displayName: string
  subject: string | null
  status: ConversationStatus
  assigneeId: string | null
  channel: { provider: ChannelProvider; name: string }
  lastMessageAt: string
  preview: string
  direction: "in" | "out" | null
  unread: number
  tags: TagOption[]
}

export type InboxFilters = {
  status: StatusFilter
  assignment: AssignmentFilter
  channelId: string
  tagId: string
  q: string
  limit: number
}

const LIST_COLUMNS =
  "id, display_name, subject, status, assignee_id, last_message_at, last_message_preview, last_message_direction, channel:channels!inner(provider, name), tags:conversation_tags(tag:tags(id, name, color))"

/** Conversațiile vizibile (RLS: toate / echipă / proprii + neatribuite), cele mai recente primele. */
export async function listConversations(
  organizationId: string,
  userId: string,
  filters: InboxFilters
): Promise<{ items: ConversationListItem[]; hasMore: boolean }> {
  const supabase = await createClient()
  let query = supabase
    .from("conversations")
    .select(LIST_COLUMNS)
    .eq("organization_id", organizationId)
    .order("last_message_at", { ascending: false })
    .order("id")
    .limit(filters.limit + 1)

  if (filters.status !== "all") query = query.eq("status", filters.status)
  if (filters.assignment === "mine") query = query.eq("assignee_id", userId)
  if (filters.assignment === "unassigned") query = query.is("assignee_id", null)
  if (filters.channelId) query = query.eq("channel_id", filters.channelId)
  if (filters.tagId) {
    query = query.in("id", await idsWithTag("conversation_tags", "conversation_id", filters.tagId))
  }
  if (filters.q.trim()) query = query.or(searchFilter(filters.q))

  const { data, error } = await query
  if (error) throw error
  const rows = data.slice(0, filters.limit)
  const unread = await unreadCounts(rows.map((r) => r.id))

  return {
    hasMore: data.length > filters.limit,
    items: rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      subject: r.subject,
      status: r.status as ConversationStatus,
      assigneeId: r.assignee_id,
      channel: { provider: r.channel.provider as ChannelProvider, name: r.channel.name },
      lastMessageAt: r.last_message_at,
      preview: r.last_message_preview,
      direction: r.last_message_direction as "in" | "out" | null,
      unread: unread.get(r.id) ?? 0,
      tags: r.tags.map((t) => t.tag),
    })),
  }
}

async function unreadCounts(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("inbox_unread_counts", { p_ids: ids })
  if (error) throw error
  return new Map(data.map((r) => [r.conversation_id, r.unread]))
}

export async function getConversation(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, organization_id, display_name, subject, status, assignee_id, created_at, channel:channels!inner(id, provider, name), contact:contacts(id, full_name, owner_id, deleted_at, position, company:companies(id, name), identities:contact_identities(type, value, is_primary)), lead:leads(id, title, status, value, currency, deleted_at, stage:pipeline_stages!inner(name, color, kind)), tags:conversation_tags(tag_id)"
    )
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    ...data,
    status: data.status as ConversationStatus,
    channel: { ...data.channel, provider: data.channel.provider as ChannelProvider },
    lead: data.lead
      ? { ...data.lead, stage: { ...data.lead.stage, kind: data.lead.stage.kind as StageKind } }
      : null,
  }
}
export type ConversationDetail = NonNullable<Awaited<ReturnType<typeof getConversation>>>

export type MessageItem = {
  id: number
  kind: "message" | "internal_note" | "system"
  direction: "in" | "out"
  senderUserId: string | null
  body: string
  deliveryStatus: string | null
  sentAt: string
  attachments: { id: string; fileName: string; sizeBytes: number }[]
}

/** Ultimele mesaje ale conversației, în ordine cronologică. */
export async function listMessages(conversationId: string, limit = 200): Promise<MessageItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id, kind, direction, sender_user_id, body, delivery_status, sent_at, files(id, file_name, size_bytes)"
    )
    .eq("conversation_id", conversationId)
    .order("id", { ascending: false })
    .limit(limit)
  if (error) throw error
  return data.reverse().map((m) => ({
    id: m.id,
    kind: m.kind as MessageItem["kind"],
    direction: m.direction as MessageItem["direction"],
    senderUserId: m.sender_user_id,
    body: m.body,
    deliveryStatus: m.delivery_status,
    sentAt: m.sent_at,
    attachments: m.files.map((f) => ({ id: f.id, fileName: f.file_name, sizeBytes: f.size_bytes })),
  }))
}

export type QuickReply = {
  id: string
  title: string
  shortcut: string | null
  body: string
  ownerId: string | null
}

/** Răspunsurile rapide partajate + cele personale ale utilizatorului (RLS). */
export async function listQuickReplies(organizationId: string): Promise<QuickReply[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("quick_replies")
    .select("id, title, shortcut, body, owner_id")
    .eq("organization_id", organizationId)
    .order("title")
  if (error) throw error
  return data.map((r) => ({ ...r, ownerId: r.owner_id }))
}

export type ChannelItem = {
  id: string
  provider: ChannelProvider
  name: string
  status: string
  hasWebhookSecret: boolean
}

export async function listChannels(organizationId: string): Promise<ChannelItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("channels")
    .select("id, provider, name, status, has_webhook_secret, created_at")
    .eq("organization_id", organizationId)
    .order("created_at")
  if (error) throw error
  return data.map((c) => ({
    id: c.id,
    provider: c.provider as ChannelProvider,
    name: c.name,
    status: c.status,
    hasWebhookSecret: Boolean(c.has_webhook_secret),
  }))
}

export type RecordConversation = {
  id: string
  displayName: string
  status: ConversationStatus
  channelProvider: ChannelProvider
  lastMessageAt: string
  preview: string
}

/** Conversațiile legate de un lead sau contact (secțiunea „Conversații” din fișă). */
export async function listConversationsFor(ref: RecordRef): Promise<RecordConversation[]> {
  if (ref.entity === "company") return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, display_name, status, last_message_at, last_message_preview, channel:channels!inner(provider)"
    )
    .eq(ref.entity === "lead" ? "lead_id" : "contact_id", ref.id)
    .order("last_message_at", { ascending: false })
    .limit(50)
  if (error) throw error
  return data.map((c) => ({
    id: c.id,
    displayName: c.display_name,
    status: c.status as ConversationStatus,
    channelProvider: c.channel.provider as ChannelProvider,
    lastMessageAt: c.last_message_at,
    preview: c.last_message_preview,
  }))
}

/** Lead-urile deschise ale contactului (pentru asocierea cu conversația). */
export async function listContactOpenLeads(contactId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("lead_contacts")
    .select("lead:leads!inner(id, title, status, deleted_at)")
    .eq("contact_id", contactId)
    .eq("lead.status", "open")
    .is("lead.deleted_at", null)
    .limit(20)
  if (error) throw error
  return data.map((r) => ({ id: r.lead.id, name: r.lead.title }))
}
