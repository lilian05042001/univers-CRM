import "server-only"

import { idsWithTag, searchFilter } from "@/lib/crm/records"
import { isUuid, pageRange, type ListParams } from "@/lib/list-params"
import { createClient } from "@/lib/supabase/server"
import { containsPattern, normalizeSearch } from "@/lib/utils/search"
import type { TagOption } from "@/modules/crm-config/types"

import type { COMPANY_SORT_KEYS } from "./schemas"

type SortKey = (typeof COMPANY_SORT_KEYS)[number]

export type CompanyRow = {
  id: string
  name: string
  industry: string | null
  phone: string | null
  email: string | null
  ownerId: string | null
  contactCount: number
  leadCount: number
  createdAt: string
  tags: TagOption[]
}

/** Id-urile companiilor al căror telefon sau e-mail conține termenul căutat. */
async function idsMatchingContactData(organizationId: string, q: string) {
  const supabase = await createClient()
  const digits = q.replace(/[^\d+]/g, "")
  let query = supabase
    .from("companies")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(200)
  query =
    digits.length >= 3
      ? query.ilike("phone_normalized", containsPattern(digits))
      : query.ilike("email", containsPattern(normalizeSearch(q)))
  const { data, error } = await query
  if (error) throw error
  return data.map((r) => r.id)
}

export async function listCompanies(organizationId: string, params: ListParams<SortKey>) {
  const supabase = await createClient()
  let query = supabase
    .from("companies")
    .select(
      "id, name, industry, phone, email, owner_id, created_at, contacts(count), leads(count), tags:company_tags(tag:tags(id, name, color))",
      { count: "exact" }
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  if (params.q)
    query = query.or(searchFilter(params.q, await idsMatchingContactData(organizationId, params.q)))

  const owner = params.get("owner")
  if (owner === "none") query = query.is("owner_id", null)
  else if (isUuid(owner)) query = query.eq("owner_id", owner)

  const tag = params.get("tag")
  if (isUuid(tag)) {
    const ids = await idsWithTag("company_tags", "company_id", tag)
    if (ids.length === 0) return { rows: [] as CompanyRow[], total: 0 }
    query = query.in("id", ids)
  }

  const { from, to } = pageRange(params)
  const { data, error, count } = await query
    .order(params.sort, { ascending: params.dir === "asc" })
    .order("id")
    .range(from, to)
  if (error) throw error

  const rows: CompanyRow[] = data.map((c) => ({
    id: c.id,
    name: c.name,
    industry: c.industry,
    phone: c.phone,
    email: c.email,
    ownerId: c.owner_id,
    contactCount: c.contacts[0]?.count ?? 0,
    leadCount: c.leads[0]?.count ?? 0,
    createdAt: c.created_at,
    tags: c.tags.map((t) => t.tag),
  }))
  return { rows, total: count ?? 0 }
}

export async function getCompany(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, industry, phone, email, website, owner_id, address, custom_fields, tags:company_tags(tag_id)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw error
  return data
}

export type CompanyRecord = NonNullable<Awaited<ReturnType<typeof getCompany>>>
