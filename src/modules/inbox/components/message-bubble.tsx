"use client"

import { AlertCircle, Check, CheckCheck, Clock, Paperclip, StickyNote } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { toast } from "sonner"
import { cn } from "cn"

import { getFileUrl } from "@/modules/files/actions"

import type { MessageItem } from "../queries"

const DELIVERY_ICONS = {
  queued: Clock,
  sent: Check,
  delivered: CheckCheck,
  read: CheckCheck,
  failed: AlertCircle,
} as const

export function MessageBubble({
  message,
  senderName,
}: {
  message: MessageItem
  senderName: string | undefined
}) {
  const t = useTranslations("inbox.message")
  const tAll = useTranslations()
  const format = useFormatter()
  const isNote = message.kind === "internal_note"
  const outgoing = message.direction === "out" && !isNote
  const time = format.dateTime(new Date(message.sentAt), { timeStyle: "short" })
  const DeliveryIcon =
    outgoing && message.deliveryStatus
      ? DELIVERY_ICONS[message.deliveryStatus as keyof typeof DELIVERY_ICONS]
      : null

  async function download(id: string) {
    const result = await getFileUrl({ id })
    if (result.ok) window.location.assign(result.data.url)
    else toast.error(tAll(result.error))
  }

  if (message.kind === "system") {
    return <p className="text-center text-xs text-muted-foreground">{message.body}</p>
  }

  return (
    <div className={cn("flex", outgoing || isNote ? "justify-end" : "justify-start")}>
      <div
        data-kind={message.kind}
        data-direction={message.direction}
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm sm:max-w-[70%]",
          isNote &&
            "border border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100",
          outgoing && "bg-primary text-primary-foreground",
          !outgoing && !isNote && "bg-muted"
        )}
      >
        {isNote && (
          <p className="mb-1 flex items-center gap-1 text-xs font-medium">
            <StickyNote className="size-3" />
            {t("note")}
          </p>
        )}
        {message.body && <p className="break-words whitespace-pre-wrap">{message.body}</p>}
        {message.attachments.length > 0 && (
          <ul className="mt-1 flex flex-col gap-1">
            {message.attachments.map((file) => (
              <li key={file.id}>
                <button
                  type="button"
                  onClick={() => download(file.id)}
                  className="flex max-w-full items-center gap-1.5 text-left underline-offset-2 hover:underline"
                >
                  <Paperclip className="size-3.5 shrink-0" />
                  <span className="truncate">{file.fileName}</span>
                  <span className="shrink-0 opacity-70">
                    {format.number(file.sizeBytes / 1024, { maximumFractionDigits: 0 })} KB
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[11px]",
            outgoing ? "text-primary-foreground/75" : "text-muted-foreground"
          )}
        >
          {senderName &&
            (message.direction === "in" ? t("loggedBy", { name: senderName }) : senderName)}
          {senderName && " · "}
          <time dateTime={message.sentAt}>{time}</time>
          {DeliveryIcon && (
            <DeliveryIcon className="size-3" aria-label={t(`delivery.${message.deliveryStatus}`)} />
          )}
        </p>
      </div>
    </div>
  )
}
