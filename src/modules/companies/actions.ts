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

import { companyDuplicateCheckSchema, companySchema } from "./schemas"

export const saveCompany = createOrgAction({ schema: companySchema }, async (input, ctx) => {
  if (!ctx.can(input.id ? "contacts.edit" : "contacts.create")) return fail("errors.forbidden")

  const defs = (await getCrmOptions(ctx.organizationId)).customFields.filter(
    (d) => d.entity === "company"
  )
  const custom = parseCustomFields(defs, input.customFields)
  if (!custom.ok) return fail("errors.validation", prefixFieldErrors("customFields", custom.errors))

  const website =
    input.website && !/^https?:\/\//i.test(input.website)
      ? `https://${input.website}`
      : input.website
  const id = input.id ?? randomUUID()
  const fields = {
    name: input.name,
    industry: emptyToNull(input.industry),
    phone: input.phone ? normalizePhone(input.phone) : null,
    email: emptyToNull(input.email.toLowerCase()),
    website: emptyToNull(website),
    owner_id: input.ownerId,
    address: { city: input.city, street: input.street },
    custom_fields: custom.data,
  }

  const supabase = await createClient()
  const { error } = input.id
    ? await supabase
        .from("companies")
        .update(fields)
        .eq("id", id)
        .eq("organization_id", ctx.organizationId)
    : await supabase
        .from("companies")
        .insert({ id, organization_id: ctx.organizationId, ...fields })
  if (error) throw error

  await syncTags("company_tags", "company_id", ctx.organizationId, id, input.tagIds)
  return ok({ id })
})

export const checkCompanyDuplicates = createOrgAction(
  { schema: companyDuplicateCheckSchema },
  async ({ name, phone, email, excludeId }, ctx) => {
    if (!name.trim() && !phone.trim() && !email.trim()) return ok([])
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("find_company_duplicates", {
      p_org: ctx.organizationId,
      p_name: name.trim(),
      p_phone: phone.trim() ? normalizePhone(phone) : undefined,
      p_email: email.trim() || undefined,
      p_exclude: excludeId ?? undefined,
    })
    if (error) throw error
    return ok(data)
  }
)

export const deleteCompanies = createOrgAction(
  { schema: z.object({ ids: idsSchema }), permission: "contacts.delete" },
  async ({ ids }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("companies")
      .update({ deleted_at: new Date().toISOString() })
      .eq("organization_id", ctx.organizationId)
      .in("id", ids)
    if (error) throw error
    return ok()
  }
)

export const assignCompanies = createOrgAction(
  {
    schema: z.object({ ids: idsSchema, ownerId: z.uuid().nullable() }),
    permission: "contacts.edit",
  },
  async ({ ids, ownerId }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("companies")
      .update({ owner_id: ownerId })
      .eq("organization_id", ctx.organizationId)
      .in("id", ids)
    if (error) throw error
    return ok()
  }
)

export const tagCompanies = createOrgAction(
  { schema: z.object({ ids: idsSchema, tagId: z.uuid() }), permission: "contacts.edit" },
  async ({ ids, tagId }, ctx) => {
    await addTag("company_tags", "company_id", ctx.organizationId, ids, tagId)
    return ok()
  }
)

export const searchCompanyOptions = createOrgAction(
  { schema: z.object({ q: z.string().max(100) }) },
  async ({ q }, ctx) => {
    const supabase = await createClient()
    let query = supabase
      .from("companies")
      .select("id, name, industry")
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .order("name")
      .limit(10)
    if (q.trim()) query = query.or(searchFilter(q))
    const { data, error } = await query
    if (error) throw error
    return ok(data.map((c) => ({ id: c.id, label: c.name, description: c.industry ?? undefined })))
  }
)
