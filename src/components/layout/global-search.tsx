"use client"

import { Building2, Contact, Search, Target, type LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { navItems } from "@/config/navigation"
import { normalizeSearch } from "@/lib/utils/search"
import { globalSearch, type SearchResults } from "@/modules/search/actions"

const GROUPS: { key: keyof SearchResults; href: string; icon: LucideIcon }[] = [
  { key: "leads", href: "/leads", icon: Target },
  { key: "contacts", href: "/contacts", icon: Contact },
  { key: "companies", href: "/companies", icon: Building2 },
]

/** Ctrl+K: caută în lead-uri, contacte (inclusiv telefon / e-mail), companii și module. */
export function GlobalSearch() {
  const t = useTranslations("search")
  const tTopbar = useTranslations("topbar")
  const tNav = useTranslations("nav")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [results, setResults] = useState<SearchResults | null>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (q.trim().length < 2) return
    let cancelled = false
    const id = setTimeout(async () => {
      const result = await globalSearch({ q })
      if (!cancelled && result.ok) setResults(result.data)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [q])

  function go(href: string) {
    setOpen(false)
    setQ("")
    setResults(null)
    router.push(href)
  }

  const term = normalizeSearch(q)
  const modules = navItems.filter((item) => normalizeSearch(tNav(item.key)).includes(term))
  const hits = q.trim().length >= 2 ? results : null

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 max-w-md min-w-0 flex-1 shrink justify-start gap-2 bg-background px-3 font-normal text-muted-foreground"
      >
        <Search className="size-4" />
        <span className="hidden truncate sm:inline">{tTopbar("search")}</span>
        <span className="sm:hidden">{tTopbar("searchShort")}</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 text-[10px] font-medium md:inline">
          Ctrl K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} title={t("title")}>
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder={t("placeholder")} />
          <CommandList>
            <CommandEmpty>{t("empty")}</CommandEmpty>
            {hits &&
              GROUPS.map(
                (group) =>
                  hits[group.key].length > 0 && (
                    <CommandGroup key={group.key} heading={tNav(group.key)}>
                      {hits[group.key].map((hit) => (
                        <CommandItem
                          key={hit.id}
                          value={`${group.key}-${hit.id}`}
                          onSelect={() => go(`${group.href}?open=${hit.id}`)}
                        >
                          <group.icon />
                          <span className="truncate">{hit.label}</span>
                          {hit.description && (
                            <span className="ml-auto truncate text-xs text-muted-foreground">
                              {hit.description}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )
              )}
            {modules.length > 0 && (
              <CommandGroup heading={t("modules")}>
                {modules.map((item) => (
                  <CommandItem
                    key={item.key}
                    value={`module-${item.key}`}
                    onSelect={() => go(item.href)}
                  >
                    <item.icon />
                    {tNav(item.key)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
