"use client"

import { useTranslations } from "next-intl"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useListNavigation } from "@/hooks/use-list-navigation"

import { PERIODS, type Period } from "../period"

/** Perioada în URL (`period`, iar pentru „personalizat” și `from` / `to`). */
export function PeriodFilter({ period, from, to }: { period: Period; from: string; to: string }) {
  const t = useTranslations("reports.periods")
  const { setParams } = useListNavigation()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={period}
        onValueChange={(value) =>
          setParams(
            value === "custom"
              ? { period: value, from, to }
              : { period: value, from: null, to: null }
          )
        }
      >
        <SelectTrigger className="w-auto min-w-40" aria-label={t("label")}>
          <span className="text-muted-foreground">{t("label")}:</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIODS.map((p) => (
            <SelectItem key={p} value={p}>
              {t(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {period === "custom" && (
        <>
          <Input
            type="date"
            className="w-auto"
            aria-label={t("from")}
            value={from}
            max={to}
            onChange={(e) => e.target.value && setParams({ from: e.target.value })}
          />
          <Input
            type="date"
            className="w-auto"
            aria-label={t("to")}
            value={to}
            min={from}
            onChange={(e) => e.target.value && setParams({ to: e.target.value })}
          />
        </>
      )}
    </div>
  )
}
