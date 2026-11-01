import "server-only"

import { idsWithTag, searchFilter } from "@/lib/crm/records"
import { isUuid, pageRange, type ListParams } from "@/lib/list-params"
import { createClient } from "@/lib/supabase/server"
import { containsPattern, normalizeSearch } from "@/lib/utils/search"
import type { TagOption } from "@/modules/crm-config/types"

import type { CONTACT_SORT_KEYS } from "./schemas"

type SortKey = (typeof CONTACT_SORT_KEYS)[number]

export type ContactRow = {
  id: string
  name: string
  position: string | null
  company: { id: string; name: string } | null
  phone: string | null
  email: string | null
  ownerId: string | null
  createdAt: string
  tags: TagOption[]
}

function primary(identities: { type: string; value: string; is_primary: boolean }[], type: string) {
  const list = identities.filter((i) => i.type === type)
  return (list.find((i) => i.is_primary) ?? list[0])?.value ?? null
}

/** Id-urile contactelor ale căror telefoane / e-mailuri conțin termenul căutat. */
async function idsMatchingIdentity(organizationId: string, q: string) {
  const supabase = await createClient()
  const term = /\d{3,}/.test(q) ? q.replace(/[^\d+]/g, "") : normalizeSearch(q)
  if (term.length < 3) return []
  const { data, error } = await supabase
    .from("contact_identities")
    .select("contact_id")
    .eq("organization_id", organizationId)
    .ilike("value_normalized", containsPattern(term))
    .limit(200)
  if (error) throw error
  return [...new Set(data.map((r) => r.contact_id))]
}

export async function listContacts(organizationId: string, params: ListParams<SortKey>) {
  const supabase = await createClient()
  let query = supabase
    .from("contacts")
    .select(
      "id, full_name, position, created_at, owner_id, company:companies(id, name), identities:contact_identities(type, value, is_primary), tags:contact_tags(tag:tags(id, name, color))",
      { count: "exact" }
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  if (params.q)
    query = query.or(searchFilter(params.q, await idsMatchingIdentity(organizationId, params.q)))

  const owner = params.get("owner")
  if (owner === "none") query = query.is("owner_id", null)
  else if (isUuid(owner)) query = query.eq("owner_id", owner)

  const source = params.get("source")
  if (isUuid(source)) query = query.eq("source_id", source)

  const company = params.get("company")
  if (isUuid(company)) query = query.eq("company_id", company)

  const tag = params.get("tag")
  if (isUuid(tag)) {
    const ids = await idsWithTag("contact_tags", "contact_id", tag)
    if (ids.length === 0) return { rows: [] as ContactRow[], total: 0 }
    query = query.in("id", ids)
  }

  const { from, to } = pageRange(params)
  const { data, error, count } = await query
    .order(params.sort, { ascending: params.dir === "asc" })
    .order("id")
    .range(from, to)
  if (error) throw error

  const rows: ContactRow[] = data.map((c) => ({
    id: c.id,
    name: c.full_name ?? "",
    position: c.position,
    company: c.company,
    phone: primary(c.identities, "phone"),
    email: primary(c.identities, "email"),
    ownerId: c.owner_id,
    createdAt: c.created_at,
    tags: c.tags.map((t) => t.tag),
  }))
  return { rows, total: count ?? 0 }
}

export async function getContact(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, position, source_id, owner_id, address, custom_fields, company:companies(id, name), identities:contact_identities(type, value, is_primary), tags:contact_tags(tag_id)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw error
  return data
}

export type ContactRecord = NonNullable<Awaited<ReturnType<typeof getContact>>>

/** Fișa contactului: date, identități, etichete și lead-urile asociate. */
export async function getContactDetail(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "id, full_name, position, address, custom_fields, owner_id, created_at, company:companies(id, name), source:lead_sources(name), identities:contact_identities(type, value, is_primary), tags:contact_tags(tag:tags(id, name, color)), leads:lead_contacts(is_primary, lead:leads!inner(id, title, value, currency, status, deleted_at, stage:pipeline_stages!inner(name, color)))"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw error
  return data
}

export type ContactDetail = NonNullable<Awaited<ReturnType<typeof getContactDetail>>>
