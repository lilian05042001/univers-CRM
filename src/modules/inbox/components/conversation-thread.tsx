"use client"

import { useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"

import type { NamedOption } from "@/modules/crm-config/types"

import { markConversationRead } from "../actions"
import { useRealtimeRefresh } from "../hooks/use-realtime-refresh"
import type { ConversationDetail, MessageItem, QuickReply } from "../queries"

import { Composer } from "./composer"
import { ConversationHeader } from "./conversation-header"
import { MessageList } from "./message-list"

/** Coloana din mijloc: antet, mesaje (în timp real), compunere. */
export function ConversationThread({
  conversation,
  messages,
  quickReplies,
  members,
  currentUserId,
  canAssign,
  timeZone,
  unread,
  panel,
}: {
  conversation: ConversationDetail
  messages: MessageItem[]
  quickReplies: QuickReply[]
  members: NamedOption[]
  currentUserId: string
  canAssign: boolean
  timeZone: string
  /** Mesajele necitite la randare: după marcarea ca citită, lista se reîmprospătează. */
  unread: number
  panel: ReactNode
}) {
  const router = useRouter()
  const lastId = messages.at(-1)?.id
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name

  useRealtimeRefresh(
    `inbox-thread:${conversation.id}`,
    "messages",
    `conversation_id=eq.${conversation.id}`
  )

  // Conversația deschisă e citită până la ultimul mesaj afișat.
  useEffect(() => {
    void markConversationRead({ id: conversation.id }).then((result) => {
      if (result.ok && unread > 0) router.refresh()
    })
  }, [conversation.id, lastId, unread, router])

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      <ConversationHeader
        conversation={conversation}
        members={members}
        currentUserId={currentUserId}
        canAssign={canAssign}
        panel={panel}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <MessageList messages={messages} memberName={memberName} timeZone={timeZone} />
      </div>
      <Composer
        key={conversation.id}
        conversationId={conversation.id}
        allowInbound={conversation.channel.provider === "internal"}
        quickReplies={quickReplies}
      />
    </div>
  )
}
