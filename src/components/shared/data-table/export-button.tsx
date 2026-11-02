"use client"

import { Download } from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

/** Exportă lista curentă în CSV, cu aceleași filtre și sortare (fără paginare). */
export function ExportButton() {
  const t = useTranslations("table")
  const pathname = usePathname()
  const params = new URLSearchParams(useSearchParams().toString())
  for (const key of ["page", "size", "open"]) params.delete(key)
  const query = params.toString()

  return (
    <Button asChild variant="outline">
      <a href={`${pathname}/export${query ? `?${query}` : ""}`} download>
        <Download />
        {t("export")}
      </a>
    </Button>
  )
}
