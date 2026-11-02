"use client"

import { Check, Plus } from "lucide-react"
import { useTranslations } from "next-intl"

import { TagBadge } from "@/components/shared/tag-badge"
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
import { useActionRunner } from "@/lib/actions/use-action-runner"
import type { TagOption } from "@/modules/crm-config/types"

import { setConversationTags } from "../actions"

/** Etichetele conversației: fiecare bifare se salvează imediat. */
export function ConversationTags({
  conversationId,
  selected,
  tags,
}: {
  conversationId: string
  selected: string[]
  tags: TagOption[]
}) {
  const t = useTranslations("inbox.panel")
  const tAll = useTranslations()
  const { run, pending } = useActionRunner()

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    run(() => setConversationTags({ id: conversationId, tagIds: next }))
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags
        .filter((tag) => selected.includes(tag.id))
        .map((tag) => (
          <TagBadge key={tag.id} name={tag.name} color={tag.color} />
        ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2" disabled={pending}>
            <Plus />
            {t("editTags")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder={tAll("common.search")} />
            <CommandList>
              <CommandEmpty>{tAll("search.empty")}</CommandEmpty>
              <CommandGroup>
                {tags.map((tag) => (
                  <CommandItem key={tag.id} value={tag.name} onSelect={() => toggle(tag.id)}>
                    <Check className={selected.includes(tag.id) ? "opacity-100" : "opacity-0"} />
                    <TagBadge name={tag.name} color={tag.color} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
