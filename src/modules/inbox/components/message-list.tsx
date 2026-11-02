"use client"

import { useFormatter, useTranslations } from "next-intl"
import { Fragment, useEffect, useRef } from "react"

import type { MessageItem } from "../queries"

import { MessageBubble } from "./message-bubble"

/** Firul mesajelor, cu separatoare pe zile; se derulează la ultimul mesaj. */
export function MessageList({
  messages,
  memberName,
  timeZone,
}: {
  messages: MessageItem[]
  memberName: (id: string | null) => string | undefined
  timeZone: string
}) {
  const t = useTranslations("inbox")
  const format = useFormatter()
  const end = useRef<HTMLDivElement>(null)
  const lastId = messages.at(-1)?.id

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" })
  }, [lastId])

  const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone })

  if (messages.length === 0) {
    return <p className="m-auto p-6 text-center text-sm text-muted-foreground">{t("noMessages")}</p>
  }

  return (
    <div className="flex flex-col gap-2 p-4" aria-live="polite">
      {messages.map((message, i) => {
        const newDay = i === 0 || dayOf(messages[i - 1]!.sentAt) !== dayOf(message.sentAt)
        return (
          <Fragment key={message.id}>
            {newDay && (
              <p className="my-2 text-center text-xs font-medium text-muted-foreground">
                {format.dateTime(new Date(message.sentAt), { dateStyle: "medium" })}
              </p>
            )}
            <MessageBubble message={message} senderName={memberName(message.senderUserId)} />
          </Fragment>
        )
      })}
      <div ref={end} />
    </div>
  )
}
