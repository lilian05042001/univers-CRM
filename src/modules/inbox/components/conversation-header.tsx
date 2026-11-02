"use client"

import { ArrowLeft, PanelRight } from "lucide-react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import type { NamedOption } from "@/modules/crm-config/types"

import { assignConversation, setConversationStatus } from "../actions"
import type { ConversationDetail } from "../queries"
import { CONVERSATION_STATUSES, type ConversationStatus } from "../schemas"

import { ChannelIcon } from "./channel-icon"

const NOBODY = "__none__"

export function ConversationHeader({
  conversation,
  members,
  currentUserId,
  canAssign,
  panel,
}: {
  conversation: ConversationDetail
  members: NamedOption[]
  currentUserId: string
  canAssign: boolean
  /** Fișa clientului, deschisă într-un panou lateral pe ecranele înguste. */
  panel: ReactNode
}) {
  const t = useTranslations("inbox")
  const { run, pending } = useActionRunner()
  const query = useSearchParams().toString()
  const assignee = conversation.assignee_id

  const assign = (assigneeId: string | null) =>
    run(() => assignConversation({ id: conversation.id, assigneeId }), "inbox.assigned")

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
      <Button asChild variant="ghost" size="icon-sm" className="lg:hidden" aria-label={t("back")}>
        <Link href={`/inbox${query ? `?${query}` : ""}`}>
          <ArrowLeft />
        </Link>
      </Button>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-semibold">
          {conversation.display_name || t("unknownContact")}
        </h2>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <ChannelIcon provider={conversation.channel.provider} className="size-3" />
          {conversation.channel.name}
          {conversation.subject && ` · ${conversation.subject}`}
        </p>
      </div>

      <Select
        value={conversation.status}
        disabled={pending}
        onValueChange={(status) =>
          run(
            () =>
              setConversationStatus({ id: conversation.id, status: status as ConversationStatus }),
            "inbox.statusChanged"
          )
        }
      >
        <SelectTrigger size="sm" className="w-auto" aria-label={t("filters.status")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONVERSATION_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`status.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {canAssign ? (
        <Select
          value={assignee ?? NOBODY}
          disabled={pending}
          onValueChange={(v) => assign(v === NOBODY ? null : v)}
        >
          <SelectTrigger size="sm" className="w-auto max-w-48" aria-label={t("assignee")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NOBODY}>{t("unassigned")}</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : assignee === currentUserId ? (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => assign(null)}>
          {t("release")}
        </Button>
      ) : !assignee ? (
        <Button size="sm" disabled={pending} onClick={() => assign(currentUserId)}>
          {t("take")}
        </Button>
      ) : (
        <span className="text-sm text-muted-foreground">
          {members.find((m) => m.id === assignee)?.name}
        </span>
      )}

      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="xl:hidden"
            aria-label={t("panel.title")}
          >
            <PanelRight />
          </Button>
        </SheetTrigger>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("panel.title")}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">{panel}</div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
