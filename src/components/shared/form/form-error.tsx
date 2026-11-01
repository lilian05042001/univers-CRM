"use client"

import { CircleAlert } from "lucide-react"
import { useTranslations } from "next-intl"

import { Alert, AlertDescription } from "@/components/ui/alert"

/** Eroare la nivel de formular (cheie i18n primită de la Server Action). */
export function FormError({ error }: { error?: string | null }) {
  const t = useTranslations()
  if (!error) return null

  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertDescription>{t(error)}</AlertDescription>
    </Alert>
  )
}
