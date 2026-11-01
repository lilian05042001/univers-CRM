import "server-only"

import { createClient } from "@/lib/supabase/server"

export async function listMembers(organizationId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("memberships")
    .select(
      "id, status, title, created_at, role:roles!inner(id, key, name), profile:profiles!inner(id, full_name, email)"
    )
    .eq("organization_id", organizationId)
    .order("created_at")
  if (error) throw error
  return data
}

export async function listPendingInvitations(organizationId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("invitations")
    .select("id, email, expires_at, created_at, role:roles!inner(name), team:teams(name)")
    .eq("organization_id", organizationId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

export async function listTeams(organizationId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, manager_id, members:team_members(user_id)")
    .eq("organization_id", organizationId)
    .order("name")
  if (error) throw error
  return data.map((t) => ({ ...t, memberIds: t.members.map((m) => m.user_id) }))
}

export async function listRoles(organizationId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("roles")
    .select("id, key, name, description, is_system, permissions, memberships(count)")
    .eq("organization_id", organizationId)
    .order("is_system", { ascending: false })
    .order("created_at")
  if (error) throw error
  return data.map(({ memberships, ...role }) => ({
    ...role,
    memberCount: memberships[0]?.count ?? 0,
  }))
}

export type Member = Awaited<ReturnType<typeof listMembers>>[number]
export type PendingInvitation = Awaited<ReturnType<typeof listPendingInvitations>>[number]
export type Team = Awaited<ReturnType<typeof listTeams>>[number]
export type Role = Awaited<ReturnType<typeof listRoles>>[number]
