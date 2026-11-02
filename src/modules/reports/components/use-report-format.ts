"use client"

import { useFormatter, useTranslations } from "next-intl"

import type { ColumnKind } from "../types"

/** Formatarea valorilor de raport (tabel, grafic, indicatori) după tipul coloanei. */
export function useReportFormat(currency: string) {
  const format = useFormatter()
  const t = useTranslations("reports")

  return (value: string | number | null | undefined, kind: ColumnKind): string => {
    if (value === null || value === undefined || value === "") {
      return kind === "text" ? t("unassigned") : "—"
    }
    switch (kind) {
      case "int":
        return format.number(Number(value))
      case "money":
        return format.number(Number(value), {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        })
      case "percent":
        return `${format.number(Number(value), { maximumFractionDigits: 1 })}%`
      case "days":
        return t("daysValue", { days: Number(value) })
      case "date":
        return format.dateTime(new Date(`${value}T12:00:00Z`), {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        })
      case "week":
        return t("weekOf", {
          date: format.dateTime(new Date(`${value}T12:00:00Z`), {
            day: "numeric",
            month: "short",
            timeZone: "UTC",
          }),
        })
      case "month":
        return format.dateTime(new Date(`${value}T12:00:00Z`), {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })
      default:
        return String(value)
    }
  }
}
