"use client"

import { Inbox } from "lucide-react"
import Link from "next/link"
import { useFormatter, useNow, useTranslations } from "next-intl"
import { cn } from "cn"

import { FilterSelect, Toolbar } from "@/components/shared/data-table/toolbar"
import { TagBadge } from "@/components/shared/tag-badge"
import { Button } from "@/components/ui/button"
import { useListNavigation } from "@/hooks/use-list-navigation"
import type { NamedOption, TagOption } from "@/modules/crm-config/types"

import { useRealtimeRefresh } from "../hooks/use-realtime-refresh"
import type { ChannelItem, ConversationListItem } from "../queries"

import { ChannelIcon } from "./channel-icon"
import { StartConversationDialog } from "./start-conversation-dialog"

const PAGE = 50

export function ConversationList({
  items,
  hasMore,
  limit,
  activeId,
  organizationId,
  channels,
  tags,
  members,
}: {
  items: ConversationListItem[]
  hasMore: boolean
  limit: number
  activeId: string | null
  organizationId: string
  channels: ChannelItem[]
  tags: TagOption[]
  members: NamedOption[]
}) {
  const t = useTranslations("inbox")
  const format = useFormatter()
  const now = useNow({ updateInterval: 60_000 })
  const { searchParams, setParams } = useListNavigation()
  const query = searchParams.toString()
  const memberName = (id: string | null) => members.find((m) => m.id === id)?.name

  // Conversații noi / mesaje noi / atribuiri: lista se actualizează singură.
  useRealtimeRefresh(
    `inbox-list:${organizationId}`,
    "conversations",
    `organization_id=eq.${organizationId}`
  )

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-col gap-2 border-b p-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-semibold">{t("title")}</h1>
          <StartConversationDialog />
        </div>
        <Toolbar filterKeys={["status", "assign", "channel", "tag", "limit"]}>
          <FilterSelect
            param="status"
            label={t("filters.status")}
            allLabel={t("statusFilter.open")}
            options={(["pending", "closed", "all"] as const).map((s) => ({
              value: s,
              label: t(`statusFilter.${s}`),
            }))}
          />
          <FilterSelect
            param="assign"
            label={t("filters.assignment")}
            options={(["mine", "unassigned"] as const).map((a) => ({
              value: a,
              label: t(`assignment.${a}`),
            }))}
          />
          {channels.length > 1 && (
            <FilterSelect
              param="channel"
              label={t("filters.channel")}
              options={channels.map((c) => ({ value: c.id, label: c.name }))}
            />
          )}
          {tags.length > 0 && (
            <FilterSelect
              param="tag"
              label={t("filters.tag")}
              options={tags.map((tag) => ({ value: tag.id, label: tag.name }))}
            />
          )}
        </Toolbar>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
          <Inbox className="size-8" />
          {t("emptyList")}
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto" aria-label={t("title")}>
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/inbox/${c.id}${query ? `?${query}` : ""}`}
                aria-current={c.id === activeId ? "page" : undefined}
                className={cn(
                  "flex flex-col gap-1 border-b px-3 py-2.5 hover:bg-muted/60",
                  c.id === activeId && "bg-muted"
                )}
              >
                <span className="flex items-center gap-2">
                  <ChannelIcon
                    provider={c.channel.provider}
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      c.unread > 0 && "font-semibold"
                    )}
                  >
                    {c.displayName || t("unknownContact")}
                  </span>
                  <time
                    className="shrink-0 text-xs text-muted-foreground"
                    dateTime={c.lastMessageAt}
                  >
                    {format.relativeTime(new Date(c.lastMessageAt), now)}
                  </time>
                </span>
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {c.direction === "out" && `${t("you")}: `}
                    {c.preview || (c.direction ? t("attachment") : c.subject || t("noMessages"))}
                  </span>
                  {c.unread > 0 && (
                    <span
                      className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground tabular-nums"
                      aria-label={t("unread", { count: c.unread })}
                    >
                      {c.unread}
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  <span>{memberName(c.assigneeId) ?? t("unassigned")}</span>
                  {c.status !== "open" && <span>· {t(`status.${c.status}`)}</span>}
                  {c.tags.map((tag) => (
                    <TagBadge
                      key={tag.id}
                      name={tag.name}
                      color={tag.color}
                      className="h-4 px-1.5"
                    />
                  ))}
                </span>
              </Link>
            </li>
          ))}
          {hasMore && (
            <li className="p-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setParams({ limit: String(limit + PAGE) })}
              >
                {t("loadMore")}
              </Button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
