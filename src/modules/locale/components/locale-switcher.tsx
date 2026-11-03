"use client"

import { Languages } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useTransition } from "react"
import { toast } from "sonner"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { locales, type Locale } from "@/lib/i18n/config"

import { changeLocale } from "../actions"

/** Alegerea limbii interfeței; pagina se reîncarcă integral (layout-ul rădăcină depinde de limbă). */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations()
  const current = useLocale()
  const [pending, startTransition] = useTransition()

  function select(locale: string) {
    startTransition(async () => {
      const result = await changeLocale({ locale: locale as Locale })
      if (!result.ok) {
        toast.error(t(result.error))
        return
      }
      window.location.reload()
    })
  }

  return (
    <Select value={current} onValueChange={select} disabled={pending}>
      <SelectTrigger className={className} aria-label={t("locale.label")}>
        <Languages />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {locales.map((locale) => (
          <SelectItem key={locale} value={locale} lang={locale}>
            {t(`locales.${locale}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
