/** Separator „;” și BOM: Excel cu setări regionale RO/MD deschide fișierul direct pe coloane. */
export const CSV_SEPARATOR = ";"

export type CsvValue = string | number | null | undefined

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return ""
  const text = String(value)
  // Protecție la injecție de formule în Excel: textul care începe cu =, +, -, @ primește apostrof.
  // Excepție: numerele și telefoanele („+373 69 123 456”, „-15”), care nu pot executa nimic.
  const risky = /^[=+\-@\t\r]/.test(text) && !/^[+-][\d\s().]*$/.test(text)
  const safe = typeof value === "string" && risky ? `'${text}` : text
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Document CSV (antet + rânduri), gata de descărcat. */
export function toCsvDocument(header: string[], rows: CsvValue[][]): string {
  const lines = [header, ...rows].map((row) => row.map(cell).join(CSV_SEPARATOR))
  return `\uFEFF${lines.join("\r\n")}\r\n`
}

/** Răspunsul HTTP pentru descărcarea unui CSV. */
export function csvResponse(csv: string, fileName: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  })
}
