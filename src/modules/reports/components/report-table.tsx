"use client"

import { useTranslations } from "next-intl"
import { cn } from "cn"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { ReportColumn, ReportRow } from "../types"

import { useReportFormat } from "./use-report-format"

export function ReportTable({
  columns,
  rows,
  currency,
}: {
  columns: ReportColumn[]
  rows: ReportRow[]
  currency: string
}) {
  const t = useTranslations("reports")
  const fmt = useReportFormat(currency)
  const numeric = (c: ReportColumn) =>
    c.kind !== "text" && !["date", "week", "month"].includes(c.kind)

  if (rows.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">{t("noData")}</p>

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c.key} className={cn(numeric(c) && "text-right")}>
                {t(`columns.${c.key}`)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell key={c.key} className={cn(numeric(c) && "text-right tabular-nums")}>
                  {fmt(row[c.key], c.kind)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
