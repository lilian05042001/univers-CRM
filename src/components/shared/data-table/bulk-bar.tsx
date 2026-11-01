"use client"

import { X } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

/** Bara de acțiuni în masă, afișată cât timp există rânduri selectate. */
export function BulkBar({
  count,
  onClear,
  children,
}: {
  count: number
  onClear: () => void
  children: ReactNode
}) {
  const t = useTranslations("table")
  if (count === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
      <span className="text-sm font-medium">{t("selected", { count })}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="ml-auto"
        onClick={onClear}
        aria-label={t("clearSelection")}
      >
        <X />
      </Button>
    </div>
  )
}
