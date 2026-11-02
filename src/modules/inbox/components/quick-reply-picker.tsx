"use client"

import { Zap } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import type { QuickReply } from "../queries"

/** „/ofe” la începutul mesajului → răspunsurile rapide al căror shortcut începe cu „ofe”. */
export function matchShortcut(body: string, replies: QuickReply[]): QuickReply[] {
  const match = /^\/([a-z0-9_-]*)$/.exec(body)
  if (!match) return []
  return replies.filter((r) => r.shortcut?.startsWith(match[1]!)).slice(0, 6)
}

export function QuickReplyPicker({
  replies,
  onPick,
}: {
  replies: QuickReply[]
  onPick: (reply: QuickReply) => void
}) {
  const t = useTranslations("inbox.composer")
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t("quickReplies")}>
          <Zap />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder={t("searchQuickReplies")} />
          <CommandList>
            <CommandEmpty>{t("noQuickReplies")}</CommandEmpty>
            <CommandGroup>
              {replies.map((reply) => (
                <CommandItem
                  key={reply.id}
                  value={`${reply.title} ${reply.shortcut ?? ""} ${reply.body}`}
                  onSelect={() => {
                    onPick(reply)
                    setOpen(false)
                  }}
                  className="flex-col items-start gap-0.5"
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="flex-1 truncate font-medium">{reply.title}</span>
                    {reply.shortcut && (
                      <span className="font-mono text-xs text-muted-foreground">
                        /{reply.shortcut}
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{reply.body}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
