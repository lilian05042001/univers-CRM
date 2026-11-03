import "server-only"

import { getTranslations } from "next-intl/server"

import { getOrgContext, type OrgContext } from "@/lib/auth/session"
import { csvResponse, toCsvDocument, type CsvValue } from "@/lib/csv"
import { parseListParams, type SearchParams } from "@/lib/list-params"
import { createClient } from "@/lib/supabase/server"
import { utcToZonedInput, zonedToday } from "@/lib/utils/timezone"
import { listCompaniesForExport } from "@/modules/companies/queries"
import { COMPANY_SORT_KEYS } from "@/modules/companies/schemas"
import { listContactsForExport } from "@/modules/contacts/queries"
import { CONTACT_SORT_KEYS } from "@/modules/contacts/schemas"
import { getCrmOptions } from "@/modules/crm-config/queries"
import type { CustomFieldDef, CustomFieldEntity } from "@/modules/crm-config/types"
import { listLeadsForExport } from "@/modules/leads/queries"
import { LEAD_SORT_KEYS } from "@/modules/leads/schemas"

export const EXPORT_ENTITIES = ["contacts", "companies", "leads"] as const
export type ExportEntity = (typeof EXPORT_ENTITIES)[number]

type Address = { city?: string; street?: string }
type Tagged = { tags: { tag: { name: string } }[] }

/** Responsabilii apar cu e-mailul (identificatorul folosit și la import). */
async function memberEmails(organizationId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("memberships")
    .select("user_id, profile:profiles!inner(email)")
    .eq("organization_id", organizationId)
  if (error) throw error
  const emails = new Map(data.map((m) => [m.user_id, m.profile.email]))
  return (id: string | null) => (id ? (emails.get(id) ?? "") : "")
}

/** Exportul unei liste cu aceleași filtre ca pagina (antetele coincid cu maparea automată a importului). */
export async function buildExport(
  entity: ExportEntity,
  ctx: OrgContext,
  searchParams: SearchParams,
  locale: string
) {
  const t = await getTranslations({ locale, namespace: "importExport" })
  const tLeads = await getTranslations({ locale, namespace: "leads" })
  const timeZone = ctx.membership.organization.timezone
  const options = await getCrmOptions(ctx.organizationId)
  const owner = await memberEmails(ctx.organizationId)

  const defsFor = (e: CustomFieldEntity) => options.customFields.filter((d) => d.entity === e)
  const label = (key: string) => t(`fields.${key}`)
  const dateTime = (v: string | null) => (v ? utcToZonedInput(v, timeZone).replace("T", " ") : "")
  const tags = (r: Tagged) => r.tags.map((x) => x.tag.name).join(", ")
  const custom = (defs: CustomFieldDef[], stored: unknown): CsvValue[] => {
    const values = (stored ?? {}) as Record<string, unknown>
    return defs.map((d) => {
      const v = values[d.key]
      if (v === undefined || v === null) return ""
      if (typeof v === "boolean") return v ? t("yes") : t("no")
      return Array.isArray(v) ? v.join(", ") : String(v)
    })
  }
  const identities = (list: { type: string; value: string; is_primary: boolean }[], type: string) =>
    list
      .filter((i) => i.type === type)
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
      .map((i) => i.value)
      .join(", ")

  let header: string[]
  let rows: CsvValue[][]

  if (entity === "contacts") {
    const params = parseListParams(searchParams, {
      sortKeys: CONTACT_SORT_KEYS,
      defaultSort: "created_at",
    })
    const defs = defsFor("contact")
    const data = await listContactsForExport(ctx.organizationId, params)
    header = [
      ...["first_name", "last_name", "phone", "email", "company", "position", "source", "owner"],
      ...["tags", "city", "street", "created_at"],
    ]
      .map(label)
      .concat(defs.map((d) => d.label))
    rows = data.map((c) => {
      const address = (c.address ?? {}) as Address
      return [
        c.first_name,
        c.last_name,
        identities(c.identities, "phone"),
        identities(c.identities, "email"),
        c.company?.name,
        c.position,
        c.source?.name,
        owner(c.owner_id),
        tags(c),
        address.city,
        address.street,
        dateTime(c.created_at),
        ...custom(defs, c.custom_fields),
      ]
    })
  } else if (entity === "companies") {
    const params = parseListParams(searchParams, {
      sortKeys: COMPANY_SORT_KEYS,
      defaultSort: "created_at",
    })
    const defs = defsFor("company")
    const data = await listCompaniesForExport(ctx.organizationId, params)
    header = ["name", "industry", "phone", "email", "website", "owner", "tags", "city", "street"]
      .concat("created_at")
      .map((key) => (key === "name" ? t("fields.companyName") : label(key)))
      .concat(defs.map((d) => d.label))
    rows = data.map((c) => {
      const address = (c.address ?? {}) as Address
      return [
        c.name,
        c.industry,
        c.phone,
        c.email,
        c.website,
        owner(c.owner_id),
        tags(c),
        address.city,
        address.street,
        dateTime(c.created_at),
        ...custom(defs, c.custom_fields),
      ]
    })
  } else {
    const params = parseListParams(searchParams, {
      sortKeys: LEAD_SORT_KEYS,
      defaultSort: "created_at",
    })
    const defs = defsFor("lead")
    const data = await listLeadsForExport(ctx.organizationId, ctx.user.id, params)
    header = [
      ...["title", "pipeline", "stage", "status", "value", "currency", "won_amount", "contact"],
      ...["company", "source", "owner", "team", "priority", "tags", "created_at", "closed_at"],
    ]
      .map(label)
      .concat(defs.map((d) => d.label))
    rows = data.map((l) => {
      const contact = l.contacts.find((c) => c.is_primary) ?? l.contacts[0]
      return [
        l.title,
        options.pipelines.find((p) => p.id === l.pipeline_id)?.name,
        l.stage.name,
        t(`leadStatus.${l.status}`),
        Number(l.value),
        l.currency,
        l.won_amount === null ? null : Number(l.won_amount),
        contact?.contact.full_name,
        l.company?.name,
        l.source?.name,
        owner(l.responsible_id),
        l.team?.name,
        tLeads(`priority.${l.priority}`),
        tags(l),
        dateTime(l.created_at),
        dateTime(l.closed_at),
        ...custom(defs, l.custom_fields),
      ]
    })
  }

  return {
    csv: toCsvDocument(header, rows),
    fileName: `${t(`fileNames.${entity}`)}-${zonedToday(timeZone)}.csv`,
  }
}

/** Route handler-ul exportului (/contacts/export?…filtrele listei); necesită data.export. */
export async function exportResponse(
  entity: ExportEntity,
  request: Request,
  locale: string
): Promise<Response> {
  const ctx = await getOrgContext()
  if (!ctx.can("data.export")) return new Response("Forbidden", { status: 403 })
  const searchParams = Object.fromEntries(new URL(request.url).searchParams)
  const { csv, fileName } = await buildExport(entity, ctx, searchParams, locale)
  return csvResponse(csv, fileName)
}
