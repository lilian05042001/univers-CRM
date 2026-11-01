"use server"

// Schimbarea organizației active schimbă tot contextul aplicației: clientul face o navigare
// completă (enterOrganization), nu un redirect din acțiune, ca routerul să nu refolosească
// rute din cache randate pentru organizația anterioară.

import { createAction, createOrgAction } from "@/lib/actions/action"
import { fail, ok } from "@/lib/actions/result"
import { getMemberships, requireUser, setActiveOrganization } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { emptyToNull } from "@/lib/utils/format"

import {
  acceptInvitationSchema,
  companySettingsSchema,
  createOrganizationSchema,
  switchOrganizationSchema,
} from "./schemas"

export const createOrganization = createAction(createOrganizationSchema, async ({ name }) => {
  await requireUser()
  const supabase = await createClient()
  const { data: organizationId, error } = await supabase.rpc("create_organization", {
    p_name: name,
  })
  if (error) throw error

  await setActiveOrganization(organizationId)
  return ok({ organizationId })
})

export const switchOrganization = createAction(
  switchOrganizationSchema,
  async ({ organizationId }) => {
    const memberships = await getMemberships()
    if (!memberships.some((m) => m.organization.id === organizationId)) {
      return fail("errors.forbidden")
    }
    await setActiveOrganization(organizationId)
    return ok({ organizationId })
  }
)

export const acceptInvitation = createAction(acceptInvitationSchema, async ({ token }) => {
  await requireUser()
  const supabase = await createClient()
  const { data: organizationId, error } = await supabase.rpc("accept_invitation", {
    p_token: token,
  })
  if (error) throw error

  await setActiveOrganization(organizationId)
  return ok({ organizationId })
})

export const updateCompanySettings = createOrgAction(
  { schema: companySettingsSchema, permission: "settings.manage" },
  async (input, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("organizations")
      .update({
        name: input.name,
        legal_name: emptyToNull(input.legalName),
        fiscal_code: emptyToNull(input.fiscalCode),
        country: input.country,
        currency: input.currency,
        timezone: input.timezone,
        default_locale: input.defaultLocale,
      })
      .eq("id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)
