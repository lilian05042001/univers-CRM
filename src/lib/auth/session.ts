import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { createClient } from "@/lib/supabase/server"
import { roleHasPermission, type Permission } from "@/modules/auth/permissions"

export const ACTIVE_ORG_COOKIE = "active_org"

export type SessionUser = { id: string; email: string }

export type MembershipSummary = {
  membershipId: string
  organization: { id: string; name: string; currency: string; timezone: string }
  role: { id: string; key: string; name: string; permissions: string[] }
}

export type OrgContext = {
  user: SessionUser
  membership: MembershipSummary
  memberships: MembershipSummary[]
  organizationId: string
  can: (permission: Permission) => boolean
}

export class ForbiddenError extends Error {
  constructor() {
    super("forbidden")
  }
}

/** Utilizatorul autentificat (JWT verificat), sau null. O singură verificare per cerere. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" }
})

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect("/login")
  return user
}

export const getMemberships = cache(async (): Promise<MembershipSummary[]> => {
  const user = await requireUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id, organization:organizations!inner(id, name, currency, timezone), role:roles!inner(id, key, name, permissions)"
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at")

  if (error) throw error
  return data.map((m) => ({ membershipId: m.id, organization: m.organization, role: m.role }))
})

/**
 * Organizația activă (din cookie, validată față de membership-urile reale).
 * Fără nicio organizație → onboarding.
 */
export const getOrgContext = cache(async (): Promise<OrgContext> => {
  const user = await requireUser()
  const memberships = await getMemberships()
  if (memberships.length === 0) redirect("/onboarding")

  const preferred = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value
  const membership = memberships.find((m) => m.organization.id === preferred) ?? memberships[0]

  return {
    user,
    membership,
    memberships,
    organizationId: membership.organization.id,
    can: (permission) => roleHasPermission(membership.role, permission),
  }
})

/** Pentru Server Actions: aruncă ForbiddenError dacă lipsește permisiunea. */
export async function requirePermission(permission: Permission): Promise<OrgContext> {
  const ctx = await getOrgContext()
  if (!ctx.can(permission)) throw new ForbiddenError()
  return ctx
}

export async function setActiveOrganization(organizationId: string) {
  ;(await cookies()).set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
}

export async function clearActiveOrganization() {
  ;(await cookies()).delete(ACTIVE_ORG_COOKIE)
}
