import { toCsvDocument } from "@/lib/csv"

import type { ReportColumn, ReportRow } from "./types"

export function toCsv(
  columns: ReportColumn[],
  rows: ReportRow[],
  header: (column: ReportColumn) => string,
  emptyText: string
): string {
  return toCsvDocument(
    columns.map(header),
    rows.map((row) =>
      columns.map((c) => (c.kind === "text" && row[c.key] === null ? emptyText : row[c.key]))
    )
  )
}
