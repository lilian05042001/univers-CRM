"use client"

import { MessagesSquare } from "lucide-react"
import Link from "next/link"
import { useFormatter, useNow, useTranslations } from "next-intl"

import { EmptyState } from "@/components/shared/empty-state"

import type { RecordConversation } from "../queries"

import { ChannelIcon } from "./channel-icon"

/** Secțiunea „Conversații” din fișa lead-ului / contactului. */
export function ConversationsPanel({ conversations }: { conversations: RecordConversation[] }) {
  const t = useTranslations("inbox")
  const format = useFormatter()
  const now = useNow()

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title={t("record.emptyTitle")}
        description={t("record.emptyHint")}
      />
    )
  }

  return (
    <ul className="divide-y rounded-lg border bg-card">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link
            href={`/inbox/${c.id}`}
            className="flex flex-col gap-0.5 px-3 py-2.5 hover:bg-muted/60"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <ChannelIcon
                provider={c.channelProvider}
                className="size-3.5 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 truncate">{c.displayName}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {t(`status.${c.status}`)} · {format.relativeTime(new Date(c.lastMessageAt), now)}
              </span>
            </span>
            {c.preview && (
              <span className="truncate text-xs text-muted-foreground">{c.preview}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
