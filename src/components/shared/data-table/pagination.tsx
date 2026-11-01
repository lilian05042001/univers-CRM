"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useListNavigation } from "@/hooks/use-list-navigation"
import { PAGE_SIZES } from "@/lib/list-params"

export function Pagination({
  total,
  page,
  pageSize,
}: {
  total: number
  page: number
  pageSize: number
}) {
  const t = useTranslations("table")
  const { setParams, pending } = useListNavigation()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>{t("range", { from, to, total })}</span>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(size) => setParams({ size })}>
          <SelectTrigger size="sm" className="w-20" aria-label={t("pageSize")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page <= 1 || pending}
          onClick={() => setParams({ page: String(page - 1) }, { resetPage: false })}
          aria-label={t("previous")}
        >
          <ChevronLeft />
        </Button>
        <span className="tabular-nums">{t("page", { page, pages })}</span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={page >= pages || pending}
          onClick={() => setParams({ page: String(page + 1) }, { resetPage: false })}
          aria-label={t("next")}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
