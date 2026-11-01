"use server"

import { randomUUID } from "node:crypto"

import { z } from "zod"

import { createOrgAction } from "@/lib/actions/action"
import { fail, ok } from "@/lib/actions/result"
import { addTag, idsSchema, searchFilter, syncTags } from "@/lib/crm/records"
import { createClient } from "@/lib/supabase/server"
import { emptyToNull } from "@/lib/utils/format"
import { normalizePhone } from "@/lib/utils/phone"
import { parseCustomFields, prefixFieldErrors } from "@/modules/crm-config/custom-fields"
import { getCrmOptions } from "@/modules/crm-config/queries"

import { contactSchema, duplicateCheckSchema, mergeContactsSchema } from "./schemas"
import { writeContactIdentities } from "./service"

export const saveContact = createOrgAction({ schema: contactSchema }, async (input, ctx) => {
  if (!ctx.can(input.id ? "contacts.edit" : "contacts.create")) return fail("errors.forbidden")

  const defs = (await getCrmOptions(ctx.organizationId)).customFields.filter(
    (d) => d.entity === "contact"
  )
  const custom = parseCustomFields(defs, input.customFields)
  if (!custom.ok) return fail("errors.validation", prefixFieldErrors("customFields", custom.errors))

  const id = input.id ?? randomUUID()
  const fields = {
    first_name: input.firstName,
    last_name: input.lastName,
    company_id: input.companyId,
    position: emptyToNull(input.position),
    source_id: input.sourceId,
    owner_id: input.ownerId,
    address: { city: input.city, street: input.street },
    custom_fields: custom.data,
  }

  const supabase = await createClient()
  const { error } = input.id
    ? await supabase
        .from("contacts")
        .update(fields)
        .eq("id", id)
        .eq("organization_id", ctx.organizationId)
    : await supabase.from("contacts").insert({ id, organization_id: ctx.organizationId, ...fields })
  if (error) throw error

  await writeContactIdentities(
    ctx.organizationId,
    id,
    input.phones.map((p) => p.value),
    input.emails.map((e) => e.value)
  )
  await syncTags("contact_tags", "contact_id", ctx.organizationId, id, input.tagIds)
  return ok({ id })
})

export const checkContactDuplicates = createOrgAction(
  { schema: duplicateCheckSchema },
  async ({ phones, emails, excludeId }, ctx) => {
    const identities = [
      ...phones.filter((p) => p.trim()).map((p) => ({ type: "phone", value: normalizePhone(p) })),
      ...emails
        .filter((e) => e.trim())
        .map((e) => ({ type: "email", value: e.trim().toLowerCase() })),
    ]
    if (identities.length === 0) return ok([])

    const supabase = await createClient()
    const { data, error } = await supabase.rpc("find_contact_duplicates", {
      p_org: ctx.organizationId,
      p_identities: identities,
      p_exclude: excludeId ?? undefined,
    })
    if (error) throw error
    return ok(data)
  }
)

export const mergeContacts = createOrgAction(
  { schema: mergeContactsSchema, permission: "contacts.delete" },
  async ({ keepId, removeId }) => {
    const supabase = await createClient()
    const { error } = await supabase.rpc("merge_contacts", { p_keep: keepId, p_remove: removeId })
    if (error) throw error
    return ok()
  }
)

export const deleteContacts = createOrgAction(
  { schema: z.object({ ids: idsSchema }), permission: "contacts.delete" },
  async ({ ids }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("contacts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("organization_id", ctx.organizationId)
      .in("id", ids)
    if (error) throw error
    return ok()
  }
)

export const assignContacts = createOrgAction(
  {
    schema: z.object({ ids: idsSchema, ownerId: z.uuid().nullable() }),
    permission: "contacts.edit",
  },
  async ({ ids, ownerId }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("contacts")
      .update({ owner_id: ownerId })
      .eq("organization_id", ctx.organizationId)
      .in("id", ids)
    if (error) throw error
    return ok()
  }
)

export const tagContacts = createOrgAction(
  { schema: z.object({ ids: idsSchema, tagId: z.uuid() }), permission: "contacts.edit" },
  async ({ ids, tagId }, ctx) => {
    await addTag("contact_tags", "contact_id", ctx.organizationId, ids, tagId)
    return ok()
  }
)

/** Căutare pentru selectoare (ex. contactul unui lead). */
export const searchContactOptions = createOrgAction(
  { schema: z.object({ q: z.string().max(100) }) },
  async ({ q }, ctx) => {
    const supabase = await createClient()
    let query = supabase
      .from("contacts")
      .select("id, full_name, company:companies(name)")
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .order("full_name")
      .limit(10)
    if (q.trim()) query = query.or(searchFilter(q))
    const { data, error } = await query
    if (error) throw error
    return ok(
      data.map((c) => ({ id: c.id, label: c.full_name ?? "", description: c.company?.name }))
    )
  }
)
