"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Search } from "lucide-react"

import { navItems } from "@/config/navigation"
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

// Căutarea în date (lead-uri, contacte, companii) se adaugă în Etapa 4;
// până atunci paleta oferă navigare rapidă între module.
export function GlobalSearch() {
  const t = useTranslations("search")
  const tTopbar = useTranslations("topbar")
  const tNav = useTranslations("nav")
  const router = useRouter()
  const [open, setOpen] = useState(false)

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
        <Command>
          <CommandInput placeholder={t("placeholder")} />
          <CommandList>
            <CommandEmpty>{t("empty")}</CommandEmpty>
            <CommandGroup heading={t("modules")}>
              {navItems.map((item) => (
                <CommandItem
                  key={item.key}
                  value={tNav(item.key)}
                  onSelect={() => {
                    setOpen(false)
                    router.push(item.href)
                  }}
                >
                  <item.icon />
                  {tNav(item.key)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
