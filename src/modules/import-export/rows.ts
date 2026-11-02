import { z } from "zod"

import type { Json } from "@/lib/supabase/database.types"
import { normalizePhone } from "@/lib/utils/phone"
import { parseCustomFields, type CustomFieldValues } from "@/modules/crm-config/custom-fields"
import type { CustomFieldDef } from "@/modules/crm-config/types"

import { CUSTOM_PREFIX, type ImportEntity } from "./fields"

/** Un rând din fișier: numărul lui (antetul e rândul 1) și valorile pe câmpuri, după mapare. */
export type RawImportRow = { row: number; values: Record<string, string> }

/** Eroare din raport: `code` e o cheie i18n `validation.*` sau un cod din importExport.errors. */
export type ImportError = { row: number; code: string; field?: string }

type Values = Record<string, string>
type RowResult =
  { ok: true; data: Record<string, Json> } | { ok: false; code: string; field: string }

class RowError extends Error {
  constructor(
    readonly code: string,
    readonly field: string
  ) {
    super(code)
  }
}

const PHONE_PATTERN = /^[+\d\s()./-]*$/

/** Valorile multiple dintr-o celulă: „a, b; c” → [a, b, c]. */
export function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[,;\n]+/)
    .map((v) => v.trim())
    .filter(Boolean)
}

function text(values: Values, field: string, max: number): string {
  const value = (values[field] ?? "").trim()
  if (value.length > max) throw new RowError("validation.tooLong", field)
  return value
}

function phones(values: Values, max: number): string[] {
  const list = splitList(values.phone)
  for (const p of list) {
    if (p.length > 40 || !PHONE_PATTERN.test(p)) throw new RowError("validation.phone", "phone")
  }
  return [...new Set(list.map((p) => normalizePhone(p)))].slice(0, max)
}

function emails(values: Values, max: number): string[] {
  const list = splitList(values.email).map((e) => e.toLowerCase())
  for (const e of list) {
    if (e.length > 254 || !z.email().safeParse(e).success)
      throw new RowError("validation.email", "email")
  }
  return [...new Set(list)].slice(0, max)
}

function tags(values: Values): string[] {
  const list = splitList(values.tags)
  if (list.some((t) => t.length > 40)) throw new RowError("validation.tooLong", "tags")
  return list.slice(0, 30)
}

const TRUE_VALUES = new Set(["da", "yes", "true", "1", "x", "✓", "+", "да"])

/** Textul din CSV → valoarea de formular a câmpului personalizat (validarea rămâne la parseCustomFields). */
function customFormValue(def: CustomFieldDef, raw: string): string | boolean | string[] {
  const value = raw.trim()
  switch (def.type) {
    case "bool":
      return TRUE_VALUES.has(value.toLowerCase())
    case "multiselect":
      return splitList(value)
    case "number":
      return value.replace(/\s/g, "")
    case "date": {
      const m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(value)
      return m ? `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : value
    }
    default:
      return value
  }
}

/** Doar câmpurile personalizate mapate se validează (cele nemapate rămân goale, ca la creare din API). */
function customFields(values: Values, defs: CustomFieldDef[]): Record<string, Json> {
  const mapped = defs.filter((d) => `${CUSTOM_PREFIX}${d.key}` in values)
  const form: CustomFieldValues = {}
  for (const def of mapped)
    form[def.key] = customFormValue(def, values[`${CUSTOM_PREFIX}${def.key}`]!)
  const parsed = parseCustomFields(mapped, form)
  if (!parsed.ok) {
    const [key, code] = Object.entries(parsed.errors)[0]!
    throw new RowError(code, `${CUSTOM_PREFIX}${key}`)
  }
  return parsed.data
}

function contactRow(values: Values, defs: CustomFieldDef[]): Record<string, Json> {
  let first = text(values, "first_name", 80)
  let last = text(values, "last_name", 80)
  if (!first && !last) {
    const [head = "", ...rest] = text(values, "full_name", 161).split(/\s+/)
    first = head.slice(0, 80)
    last = rest.join(" ").slice(0, 80)
  }
  if (!`${first}${last}`.trim()) throw new RowError("validation.contactName", "first_name")

  return {
    first_name: first,
    last_name: last,
    phones: phones(values, 10),
    emails: emails(values, 10),
    company: text(values, "company", 200),
    position: text(values, "position", 100),
    source: text(values, "source", 100),
    owner: text(values, "owner", 254),
    tags: tags(values),
    city: text(values, "city", 100),
    street: text(values, "street", 200),
    custom_fields: customFields(values, defs),
  }
}

function companyRow(values: Values, defs: CustomFieldDef[]): Record<string, Json> {
  const name = text(values, "name", 200)
  if (!name) throw new RowError("validation.required", "name")
  let website = text(values, "website", 300)
  if (website && !/^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(website))
    throw new RowError("validation.url", "website")
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website}`

  return {
    name,
    industry: text(values, "industry", 100),
    phone: phones(values, 1)[0] ?? "",
    email: emails(values, 1)[0] ?? "",
    website,
    owner: text(values, "owner", 254),
    tags: tags(values),
    city: text(values, "city", 100),
    street: text(values, "street", 200),
    custom_fields: customFields(values, defs),
  }
}

export function prepareRow(
  entity: ImportEntity,
  values: Values,
  defs: CustomFieldDef[]
): RowResult {
  try {
    const data = entity === "contacts" ? contactRow(values, defs) : companyRow(values, defs)
    return { ok: true, data }
  } catch (error) {
    if (error instanceof RowError) return { ok: false, code: error.code, field: error.field }
    throw error
  }
}

/** Validarea unui lot pe server: rândurile curate merg la import_rows, celelalte direct în raport. */
export function prepareRows(entity: ImportEntity, rows: RawImportRow[], defs: CustomFieldDef[]) {
  const valid: Record<string, Json>[] = []
  const errors: ImportError[] = []
  for (const { row, values } of rows) {
    const result = prepareRow(entity, values, defs)
    if (result.ok) valid.push({ row, ...result.data })
    else errors.push({ row, code: result.code, field: result.field })
  }
  return { valid, errors }
}
