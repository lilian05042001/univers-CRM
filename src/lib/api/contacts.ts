import "server-only"

import { randomUUID } from "node:crypto"

import { searchFilter } from "@/lib/crm/records"

import type { ApiContext } from "./auth"
import { ApiError, type ListQuery } from "./http"
import {
  assertInOrg,
  notFound,
  replaceIdentities,
  replaceLinks,
  resolveCustomFields,
} from "./records"
import type { ContactInput } from "./schemas"

const CONTACT_SELECT =
  "id, first_name, last_name, full_name, position, company_id, source_id, owner_id, address, custom_fields, created_at, updated_at, identities:contact_identities(type, value, is_primary), tags:contact_tags(tag_id)"

type Identity = { type: string; value: string; is_primary: boolean }

function values(identities: Identity[], type: string) {
  return identities
    .filter((i) => i.type === type)
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map((i) => i.value)
}

function contactsQuery(ctx: ApiContext, count?: "exact") {
  return ctx.db
    .from("contacts")
    .select(CONTACT_SELECT, { count })
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
}

type ContactData = NonNullable<Awaited<ReturnType<typeof contactsQuery>>["data"]>[number]

function toContact(c: ContactData) {
  const address = (c.address ?? {}) as { city?: string; street?: string }
  return {
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    full_name: c.full_name,
    position: c.position,
    company_id: c.company_id,
    source_id: c.source_id,
    owner_id: c.owner_id,
    phones: values(c.identities, "phone"),
    emails: values(c.identities, "email"),
    address: { city: address.city ?? "", street: address.street ?? "" },
    tag_ids: c.tags.map((t) => t.tag_id),
    custom_fields: c.custom_fields,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }
}

export async function listContacts(ctx: ApiContext, query: ListQuery) {
  let q = contactsQuery(ctx, "exact")
  if (query.q) q = q.or(searchFilter(query.q))
  if (query.updated_since) q = q.gte("updated_at", query.updated_since)
  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .order("id")
    .range(query.offset, query.offset + query.limit - 1)
  if (error) throw error
  return { data: data.map(toContact), total: count ?? 0 }
}

export async function getContact(ctx: ApiContext, id: string) {
  const { data, error } = await contactsQuery(ctx).eq("id", id).maybeSingle()
  if (error) throw error
  return data ? toContact(data) : notFound()
}

function requireName(first: string, last: string) {
  if (!`${first}${last}`.trim())
    throw new ApiError(422, "validation_failed", { first_name: "required" })
}

export async function createContact(ctx: ApiContext, input: ContactInput) {
  requireName(input.first_name ?? "", input.last_name ?? "")
  await assertInOrg(ctx, "tags", "tag_ids", input.tag_ids)
  const id = randomUUID()
  const { error } = await ctx.db.from("contacts").insert({
    id,
    organization_id: ctx.organizationId,
    first_name: input.first_name ?? "",
    last_name: input.last_name ?? "",
    position: input.position || null,
    company_id: input.company_id ?? null,
    source_id: input.source_id ?? null,
    owner_id: input.owner_id ?? null,
    address: input.address ?? {},
    custom_fields: await resolveCustomFields(ctx, "contact", input.custom_fields, {}),
    created_by: ctx.actorId,
  })
  if (error) throw error
  await replaceIdentities(ctx, id, input.phones, input.emails)
  await replaceLinks(ctx, "contact_tags", "contact_id", id, "tag_id", input.tag_ids)
  return getContact(ctx, id)
}

export async function updateContact(ctx: ApiContext, id: string, input: ContactInput) {
  const current = await getContact(ctx, id)
  requireName(input.first_name ?? current.first_name, input.last_name ?? current.last_name)
  await assertInOrg(ctx, "tags", "tag_ids", input.tag_ids)

  const { error } = await ctx.db
    .from("contacts")
    .update({
      ...("first_name" in input && { first_name: input.first_name }),
      ...("last_name" in input && { last_name: input.last_name }),
      ...("position" in input && { position: input.position || null }),
      ...("company_id" in input && { company_id: input.company_id }),
      ...("source_id" in input && { source_id: input.source_id }),
      ...("owner_id" in input && { owner_id: input.owner_id }),
      ...(input.address && { address: { ...current.address, ...input.address } }),
      ...(input.custom_fields && {
        custom_fields: await resolveCustomFields(
          ctx,
          "contact",
          input.custom_fields,
          current.custom_fields
        ),
      }),
    })
    .eq("organization_id", ctx.organizationId)
    .eq("id", id)
  if (error) throw error
  await replaceIdentities(ctx, id, input.phones, input.emails)
  await replaceLinks(ctx, "contact_tags", "contact_id", id, "tag_id", input.tag_ids)
  return getContact(ctx, id)
}

/** Ștergere logică (ca în aplicație): contactul dispare din liste, istoricul rămâne. */
export async function deleteContact(ctx: ApiContext, id: string) {
  const { data, error } = await ctx.db
    .from("contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("organization_id", ctx.organizationId)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
  if (error) throw error
  if (data.length === 0) notFound()
}
