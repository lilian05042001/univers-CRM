"use client"

import { Search, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { useEffect, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useListNavigation } from "@/hooks/use-list-navigation"
import { setSearchDraft, useSearchDraft } from "@/hooks/use-search-draft"

const ALL = "__all__"

/** Bara de filtre a unei liste: căutare + filtre (copii) + resetare. */
export function Toolbar({ children, filterKeys }: { children?: ReactNode; filterKeys: string[] }) {
  const t = useTranslations("table")
  const pathname = usePathname()
  const { searchParams, setParams } = useListNavigation()
  const active = ["q", ...filterKeys].some((k) => searchParams.get(k))

  function reset() {
    setSearchDraft(pathname, undefined)
    setParams(Object.fromEntries(["q", ...filterKeys].map((k) => [k, null])))
  }

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <SearchInput />
      {children}
      {active && (
        <Button variant="ghost" size="sm" onClick={reset}>
          <X />
          {t("resetFilters")}
        </Button>
      )}
    </div>
  )
}

/** Căutare cu debounce; textul în curs de tastare stă în useSearchDraft, valoarea finală în URL. */
function SearchInput() {
  const t = useTranslations("table")
  const pathname = usePathname()
  const { searchParams, setParams } = useListNavigation()
  const current = searchParams.get("q") ?? ""
  const draft = useSearchDraft(pathname)

  useEffect(() => {
    if (draft === undefined) return
    if (draft.trim() === current) {
      setSearchDraft(pathname, undefined)
      return
    }
    const id = setTimeout(() => setParams({ q: draft.trim() || null }), 300)
    return () => clearTimeout(id)
  }, [draft, current, pathname, setParams])

  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={draft ?? current}
        onChange={(e) => setSearchDraft(pathname, e.target.value)}
        placeholder={t("search")}
        aria-label={t("search")}
        className="pl-8"
      />
    </div>
  )
}

export type FilterOption = { value: string; label: string }

/** Filtru cu o singură valoare, salvat în URL sub `param`. */
export function FilterSelect({
  param,
  label,
  options,
  allLabel,
}: {
  param: string
  label: string
  options: FilterOption[]
  /** Eticheta valorii implicite (fără parametru în URL); implicit „Toate”. */
  allLabel?: string
}) {
  const t = useTranslations("table")
  const { searchParams, setParams } = useListNavigation()
  const value = searchParams.get(param) ?? ALL

  return (
    <Select value={value} onValueChange={(v) => setParams({ [param]: v === ALL ? null : v })}>
      <SelectTrigger className="w-auto min-w-36" aria-label={label}>
        <span className="text-muted-foreground">{label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel ?? t("all")}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
