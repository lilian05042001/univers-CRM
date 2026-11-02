import "server-only"

import { randomUUID } from "node:crypto"

import { searchFilter } from "@/lib/crm/records"
import { normalizePhone } from "@/lib/utils/phone"

import type { ApiContext } from "./auth"
import { ApiError, type ListQuery } from "./http"
import { assertInOrg, notFound, replaceLinks, resolveCustomFields } from "./records"
import type { CompanyInput } from "./schemas"

const COMPANY_SELECT =
  "id, name, industry, phone, email, website, owner_id, address, custom_fields, created_at, updated_at, tags:company_tags(tag_id)"

function companiesQuery(ctx: ApiContext, count?: "exact") {
  return ctx.db
    .from("companies")
    .select(COMPANY_SELECT, { count })
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
}

type CompanyData = NonNullable<Awaited<ReturnType<typeof companiesQuery>>["data"]>[number]

function toCompany(c: CompanyData) {
  const address = (c.address ?? {}) as { city?: string; street?: string }
  const { tags, ...rest } = c
  return {
    ...rest,
    address: { city: address.city ?? "", street: address.street ?? "" },
    tag_ids: tags.map((t) => t.tag_id),
  }
}

export async function listCompanies(ctx: ApiContext, query: ListQuery) {
  let q = companiesQuery(ctx, "exact")
  if (query.q) q = q.or(searchFilter(query.q))
  if (query.updated_since) q = q.gte("updated_at", query.updated_since)
  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .order("id")
    .range(query.offset, query.offset + query.limit - 1)
  if (error) throw error
  return { data: data.map(toCompany), total: count ?? 0 }
}

export async function getCompany(ctx: ApiContext, id: string) {
  const { data, error } = await companiesQuery(ctx).eq("id", id).maybeSingle()
  if (error) throw error
  return data ? toCompany(data) : notFound()
}

/** Câmpurile simple prezente în cerere (absent = neschimbat, null = golit). */
function presentFields(input: CompanyInput) {
  return {
    ...(input.name && { name: input.name }),
    ...("industry" in input && { industry: input.industry || null }),
    ...("phone" in input && { phone: input.phone ? normalizePhone(input.phone) : null }),
    ...("email" in input && { email: input.email ? input.email.toLowerCase() : null }),
    ...("website" in input && { website: input.website || null }),
    ...("owner_id" in input && { owner_id: input.owner_id }),
  }
}

export async function createCompany(ctx: ApiContext, input: CompanyInput) {
  if (!input.name) throw new ApiError(422, "validation_failed", { name: "required" })
  await assertInOrg(ctx, "tags", "tag_ids", input.tag_ids)
  const id = randomUUID()
  const { error } = await ctx.db.from("companies").insert({
    id,
    organization_id: ctx.organizationId,
    ...presentFields(input),
    name: input.name,
    address: input.address ?? {},
    custom_fields: await resolveCustomFields(ctx, "company", input.custom_fields, {}),
    created_by: ctx.actorId,
  })
  if (error) throw error
  await replaceLinks(ctx, "company_tags", "company_id", id, "tag_id", input.tag_ids)
  return getCompany(ctx, id)
}

export async function updateCompany(ctx: ApiContext, id: string, input: CompanyInput) {
  const current = await getCompany(ctx, id)
  await assertInOrg(ctx, "tags", "tag_ids", input.tag_ids)
  const { error } = await ctx.db
    .from("companies")
    .update({
      ...presentFields(input),
      ...(input.address && { address: { ...current.address, ...input.address } }),
      ...(input.custom_fields && {
        custom_fields: await resolveCustomFields(
          ctx,
          "company",
          input.custom_fields,
          current.custom_fields
        ),
      }),
    })
    .eq("organization_id", ctx.organizationId)
    .eq("id", id)
  if (error) throw error
  await replaceLinks(ctx, "company_tags", "company_id", id, "tag_id", input.tag_ids)
  return getCompany(ctx, id)
}

export async function deleteCompany(ctx: ApiContext, id: string) {
  const { data, error } = await ctx.db
    .from("companies")
    .update({ deleted_at: new Date().toISOString() })
    .eq("organization_id", ctx.organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
  if (error) throw error
  if (data.length === 0) notFound()
}
