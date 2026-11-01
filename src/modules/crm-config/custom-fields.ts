import { z } from "zod"

import type { Json } from "@/lib/supabase/database.types"

import type { CustomFieldDef } from "./types"

/** Valorile din formular: text pentru câmpurile simple, boolean, listă pentru multiselect. */
export type CustomFieldValues = Record<string, string | boolean | string[]>

export const customFieldValuesSchema = z.record(
  z.string(),
  z.union([z.string().max(2000), z.boolean(), z.array(z.string().max(200)).max(50)])
)

function isEmpty(v: unknown) {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)
}

/**
 * Validează valorile față de definițiile organizației și le convertește pentru stocare (jsonb).
 * Returnează erorile pe cheie (chei i18n) sau valorile curate.
 */
export function parseCustomFields(
  defs: CustomFieldDef[],
  values: CustomFieldValues
): { ok: true; data: Record<string, Json> } | { ok: false; errors: Record<string, string> } {
  const data: Record<string, Json> = {}
  const errors: Record<string, string> = {}

  for (const def of defs) {
    const raw = values[def.key]
    if (isEmpty(raw) || raw === false) {
      if (def.isRequired && def.type !== "bool") errors[def.key] = "validation.required"
      continue
    }

    switch (def.type) {
      case "number": {
        const n = Number(String(raw).replace(",", "."))
        if (!Number.isFinite(n)) errors[def.key] = "validation.number"
        else data[def.key] = n
        break
      }
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) errors[def.key] = "validation.date"
        else data[def.key] = String(raw)
        break
      case "url":
        if (!z.url().safeParse(raw).success) errors[def.key] = "validation.url"
        else data[def.key] = String(raw)
        break
      case "select":
        if (!def.options.includes(String(raw))) errors[def.key] = "validation.option"
        else data[def.key] = String(raw)
        break
      case "multiselect": {
        const list = Array.isArray(raw) ? raw : [String(raw)]
        if (list.some((v) => !def.options.includes(v))) errors[def.key] = "validation.option"
        else data[def.key] = list
        break
      }
      case "bool":
        data[def.key] = raw === true
        break
      default:
        data[def.key] = String(raw).trim()
    }
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data }
}

/** Erorile câmpurilor personalizate, cu calea din formular („customFields.<cheie>”). */
export function prefixFieldErrors(prefix: string, errors: Record<string, string>) {
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [`${prefix}.${k}`, v]))
}

/** Valorile stocate → valorile formularului. */
export function toFormValues(defs: CustomFieldDef[], stored: unknown): CustomFieldValues {
  const source = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>
  const values: CustomFieldValues = {}
  for (const def of defs) {
    const v = source[def.key]
    if (def.type === "bool") values[def.key] = v === true
    else if (def.type === "multiselect") values[def.key] = Array.isArray(v) ? v.map(String) : []
    else values[def.key] = v === undefined || v === null ? "" : String(v)
  }
  return values
}
