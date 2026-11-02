import type { ReportColumn, ReportRow } from "./types"

/** Separator „;” și BOM: Excel cu setări regionale RO/MD deschide fișierul direct pe coloane. */
const SEPARATOR = ";"

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ""
  const text = String(value)
  // Protecție la injecție de formule în Excel: textul care începe cu =, +, -, @ primește apostrof.
  const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(
  columns: ReportColumn[],
  rows: ReportRow[],
  header: (column: ReportColumn) => string,
  emptyText: string
): string {
  const lines = [
    columns.map((c) => cell(header(c))).join(SEPARATOR),
    ...rows.map((row) =>
      columns
        .map((c) => cell(c.kind === "text" && row[c.key] === null ? emptyText : row[c.key]))
        .join(SEPARATOR)
    ),
  ]
  return `﻿${lines.join("\r\n")}\r\n`
}
