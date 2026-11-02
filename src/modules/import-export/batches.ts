import { IMPORT_LIMITS, MULTI_VALUE_FIELDS } from "./fields"
import type { RawImportRow } from "./rows"

const MAX_VALUE = 2000
/** Mărimea aproximativă a unui lot (limita implicită a unei Server Action e 1 MB). */
const MAX_BATCH_CHARS = 600_000

/** Fișierul citit: antetul și înregistrările (numărul rândului = indexul + 2, antetul e rândul 1). */
export type ParsedCsv = { headers: string[]; records: string[][] }

/** Antetul și înregistrările nevide; coloanele fără nume primesc „#n”. */
export function toParsedCsv(data: string[][]): ParsedCsv {
  const [head = [], ...records] = data
  const width = Math.max(head.length, ...records.slice(0, 100).map((r) => r.length))
  const headers = Array.from({ length: width }, (_, i) => head[i]?.trim() || `#${i + 1}`)
  return { headers, records }
}

/** Valorile unui rând pe câmpuri; coloanele mapate pe același câmp multiplu se unesc. */
export function rowValues(cells: string[], mapping: string[]): Record<string, string> {
  const values: Record<string, string> = {}
  mapping.forEach((field, index) => {
    // Apostroful pus de exporturi (protecția anti-formule) nu face parte din valoare.
    const value = (cells[index] ?? "")
      .trim()
      .replace(/^'(?=[=+\-@])/, "")
      .slice(0, MAX_VALUE)
    if (!field || !value) return
    values[field] =
      values[field] && MULTI_VALUE_FIELDS.has(field)
        ? `${values[field]}, ${value}`.slice(0, MAX_VALUE)
        : value
  })
  return values
}

/** Loturile de trimis: max. 500 de rânduri și ~600 KB; rândurile goale sunt omise. */
export function buildBatches(records: string[][], mapping: string[]): RawImportRow[][] {
  const batches: RawImportRow[][] = []
  let current: RawImportRow[] = []
  let size = 0
  records.forEach((cells, index) => {
    if (cells.every((c) => !c.trim())) return
    const row = { row: index + 2, values: rowValues(cells, mapping) }
    const rowSize = JSON.stringify(row).length
    if (current.length >= IMPORT_LIMITS.batchSize || size + rowSize > MAX_BATCH_CHARS) {
      batches.push(current)
      current = []
      size = 0
    }
    current.push(row)
    size += rowSize
  })
  if (current.length) batches.push(current)
  return batches
}

/** Numărul de rânduri cu date (fără cele goale). */
export function countDataRows(records: string[][]): number {
  return records.filter((cells) => cells.some((c) => c.trim())).length
}
