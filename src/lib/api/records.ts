import "server-only"

import type { Json } from "@/lib/supabase/database.types"
import { normalizePhone } from "@/lib/utils/phone"
import { parseCustomFields, type CustomFieldValues } from "@/modules/crm-config/custom-fields"
import type { CustomFieldDef, CustomFieldEntity } from "@/modules/crm-config/types"

import type { Admin, ApiContext } from "./auth"
import { ApiError } from "./http"

type CustomInput = Record<string, string | number | boolean | string[] | null>

/**
 * Câmpurile personalizate: valorile primite se suprapun peste cele existente, apoi întregul set
 * se validează față de definițiile organizației (ca în formulare). Cheile necunoscute sunt respinse.
 */
export async function resolveCustomFields(
  ctx: ApiContext,
  entity: CustomFieldEntity,
  input: CustomInput | undefined,
  existing: unknown
): Promise<Record<string, Json>> {
  const stored = (existing && typeof existing === "object" ? existing : {}) as Record<string, Json>
  const { data, error } = await ctx.db
    .from("custom_field_definitions")
    .select("key, label, type, options, is_required")
    .eq("organization_id", ctx.organizationId)
    .eq("entity", entity)
  if (error) throw error
  const defs: CustomFieldDef[] = data.map((d) => ({
    id: d.key,
    entity,
    key: d.key,
    label: d.label,
    type: d.type as CustomFieldDef["type"],
    options: Array.isArray(d.options) ? d.options.map(String) : [],
    isRequired: d.is_required,
  }))

  const unknown = Object.keys(input ?? {}).find((k) => !defs.some((d) => d.key === k))
  if (unknown)
    throw new ApiError(422, "validation_failed", { [`custom_fields.${unknown}`]: "unknown_field" })

  const merged = { ...stored, ...input }
  const values: CustomFieldValues = {}
  for (const [key, value] of Object.entries(merged)) {
    if (value === null || value === undefined) continue
    values[key] =
      typeof value === "boolean" ? value : Array.isArray(value) ? value.map(String) : String(value)
  }
  const parsed = parseCustomFields(defs, values)
  if (!parsed.ok) {
    const fields = Object.fromEntries(
      Object.entries(parsed.errors).map(([k, v]) => [
        `custom_fields.${k}`,
        v.replace(/^validation\./, ""),
      ])
    )
    throw new ApiError(422, "validation_failed", fields)
  }
  return parsed.data
}

/** Telefoanele și e-mailurile contactului devin exact listele date; primul e cel principal. */
export async function replaceIdentities(
  ctx: ApiContext,
  contactId: string,
  phones: string[] | undefined,
  emails: string[] | undefined
) {
  for (const [type, list] of [
    ["phone", phones?.map((p) => normalizePhone(p))],
    ["email", emails?.map((e) => e.trim().toLowerCase())],
  ] as const) {
    if (!list) continue
    const { error: delError } = await ctx.db
      .from("contact_identities")
      .delete()
      .eq("organization_id", ctx.organizationId)
      .eq("contact_id", contactId)
      .eq("type", type)
    if (delError) throw delError
    const rows = [...new Set(list)].map((value, i) => ({
      organization_id: ctx.organizationId,
      contact_id: contactId,
      type,
      value,
      is_primary: i === 0,
    }))
    if (rows.length) {
      const { error } = await ctx.db.from("contact_identities").insert(rows)
      if (error) throw error
    }
  }
}

type LinkTable = "contact_tags" | "company_tags" | "lead_tags" | "lead_contacts"
type LinkColumn = "contact_id" | "company_id" | "lead_id"

/** Legăturile unei înregistrări (etichete, contactele lead-ului) devin exact lista dată. */
export async function replaceLinks(
  ctx: ApiContext,
  table: LinkTable,
  column: LinkColumn,
  recordId: string,
  target: "tag_id" | "contact_id",
  ids: string[] | undefined
) {
  if (!ids) return
  const db: Admin = ctx.db
  const { error: delError } = await db
    .from(table)
    .delete()
    .eq("organization_id", ctx.organizationId)
    .eq(column as never, recordId as never)
  if (delError) throw delError
  const unique = [...new Set(ids)]
  if (unique.length === 0) return
  const rows = unique.map((id, i) => ({
    organization_id: ctx.organizationId,
    [column]: recordId,
    [target]: id,
    ...(table === "lead_contacts" && { is_primary: i === 0 }),
  }))
  const { error } = await db.from(table).insert(rows as never)
  if (error) throw error
}

/**
 * Etichetele / contactele referite există în organizația cheii. Se verifică înainte de orice scriere,
 * ca o referință greșită să nu lase o înregistrare creată pe jumătate.
 */
export async function assertInOrg(
  ctx: ApiContext,
  table: "tags" | "contacts",
  field: string,
  ids: string[] | undefined
) {
  const unique = [...new Set(ids ?? [])]
  if (unique.length === 0) return
  const { count, error } = await ctx.db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.organizationId)
    .in("id", unique)
  if (error) throw error
  if (count !== unique.length)
    throw new ApiError(422, "validation_failed", { [field]: "not_found" })
}

export function notFound(): never {
  throw new ApiError(404, "not_found")
}
