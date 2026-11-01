"use server"

import { createHash, randomBytes } from "node:crypto"

import { createOrgAction } from "@/lib/actions/action"
import { ok } from "@/lib/actions/result"
import { env } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import { emptyToNull } from "@/lib/utils/format"

import {
  createRoleSchema,
  createTeamSchema,
  deleteRoleSchema,
  deleteTeamSchema,
  inviteMemberSchema,
  removeMemberSchema,
  revokeInvitationSchema,
  updateMemberSchema,
  updateRoleSchema,
  updateTeamSchema,
} from "./schemas"

// ---------------------------------------------------------------- Invitații

/**
 * Creează invitația și returnează link-ul o singură dată.
 * În DB se păstrează doar hash-ul SHA-256 al tokenului.
 */
export const inviteMember = createOrgAction(
  { schema: inviteMemberSchema, permission: "team.manage" },
  async ({ email, roleId, teamId }, ctx) => {
    const token = randomBytes(32).toString("base64url")
    const supabase = await createClient()
    const { error } = await supabase.from("invitations").insert({
      organization_id: ctx.organizationId,
      email,
      role_id: roleId,
      team_id: teamId,
      token_hash: createHash("sha256").update(token).digest("hex"),
      invited_by: ctx.user.id,
    })
    if (error) throw error
    return ok({ inviteUrl: `${env.appUrl}/invite/${token}` })
  }
)

export const revokeInvitation = createOrgAction(
  { schema: revokeInvitationSchema, permission: "team.manage" },
  async ({ id }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)

// ---------------------------------------------------------------- Membri

export const updateMember = createOrgAction(
  { schema: updateMemberSchema, permission: "team.manage" },
  async ({ membershipId, roleId, status }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("memberships")
      .update({ ...(roleId && { role_id: roleId }), ...(status && { status }) })
      .eq("id", membershipId)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)

export const removeMember = createOrgAction(
  { schema: removeMemberSchema, permission: "team.manage" },
  async ({ membershipId }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("memberships")
      .delete()
      .eq("id", membershipId)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)

// ---------------------------------------------------------------- Echipe

async function syncTeamMembers(organizationId: string, teamId: string, memberIds: string[]) {
  const supabase = await createClient()
  const { data: current, error } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
  if (error) throw error

  const existing = new Set(current.map((m) => m.user_id))
  const wanted = new Set(memberIds)
  const toRemove = [...existing].filter((id) => !wanted.has(id))
  const toAdd = [...wanted].filter((id) => !existing.has(id))

  if (toRemove.length) {
    const { error: e } = await supabase
      .from("team_members")
      .delete()
      .eq("team_id", teamId)
      .in("user_id", toRemove)
    if (e) throw e
  }
  if (toAdd.length) {
    const { error: e } = await supabase
      .from("team_members")
      .insert(
        toAdd.map((user_id) => ({ organization_id: organizationId, team_id: teamId, user_id }))
      )
    if (e) throw e
  }
}

export const createTeam = createOrgAction(
  { schema: createTeamSchema, permission: "team.manage" },
  async ({ name, managerId, memberIds }, ctx) => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("teams")
      .insert({ organization_id: ctx.organizationId, name, manager_id: managerId })
      .select("id")
      .single()
    if (error) throw error
    await syncTeamMembers(ctx.organizationId, data.id, memberIds)
    return ok()
  }
)

export const updateTeam = createOrgAction(
  { schema: updateTeamSchema, permission: "team.manage" },
  async ({ id, name, managerId, memberIds }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("teams")
      .update({ name, manager_id: managerId })
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    await syncTeamMembers(ctx.organizationId, id, memberIds)
    return ok()
  }
)

export const deleteTeam = createOrgAction(
  { schema: deleteTeamSchema, permission: "team.manage" },
  async ({ id }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("teams")
      .delete()
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)

// ---------------------------------------------------------------- Roluri

function roleKey(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30)
  return `${/^[a-z]/.test(base) ? base : `role_${base}`}_${randomBytes(3).toString("hex")}`
}

export const createRole = createOrgAction(
  { schema: createRoleSchema, permission: "roles.manage" },
  async ({ name, description, permissions }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase.from("roles").insert({
      organization_id: ctx.organizationId,
      key: roleKey(name),
      name,
      description: emptyToNull(description),
      permissions,
    })
    if (error) throw error
    return ok()
  }
)

export const updateRole = createOrgAction(
  { schema: updateRoleSchema, permission: "roles.manage" },
  async ({ id, name, description, permissions }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("roles")
      .update({ name, description: emptyToNull(description), permissions })
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)

export const deleteRole = createOrgAction(
  { schema: deleteRoleSchema, permission: "roles.manage" },
  async ({ id }, ctx) => {
    const supabase = await createClient()
    const { error } = await supabase
      .from("roles")
      .delete()
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
    if (error) throw error
    return ok()
  }
)
