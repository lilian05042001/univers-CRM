"use client"

import { TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export type DuplicateMatch = {
  id: string
  name: string | null
  matchedType: string
  isVisible: boolean
}

/**
 * Avertisment pentru înregistrări posibil duplicate. Cele invizibile utilizatorului
 * apar fără nume („aparține altui coleg”), fără a expune datele.
 */
export function DuplicateWarning({
  matches,
  hrefBase,
  onMerge,
}: {
  matches: DuplicateMatch[]
  hrefBase: string
  onMerge?: (id: string) => void
}) {
  const t = useTranslations("duplicates")
  if (matches.length === 0) return null

  return (
    <Alert className="border-warning/40 bg-warning/5">
      <TriangleAlert className="text-warning" />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 flex w-full flex-col gap-1.5">
          {matches.map((m) => (
            <li key={`${m.id}-${m.matchedType}`} className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{m.name ?? t("hidden")}</span>
              <span className="text-xs">({t(`by.${m.matchedType}`)})</span>
              {m.isVisible && (
                <span className="ml-auto flex gap-1">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`${hrefBase}/${m.id}`}>{t("open")}</Link>
                  </Button>
                  {onMerge && (
                    <ConfirmDialog
                      trigger={
                        <Button type="button" variant="outline" size="sm">
                          {t("merge")}
                        </Button>
                      }
                      title={t("mergeTitle")}
                      description={t("mergeDescription", { name: m.name ?? "" })}
                      confirmLabel={t("merge")}
                      onConfirm={() => onMerge(m.id)}
                    />
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
