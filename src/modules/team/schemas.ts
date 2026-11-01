import { z } from "zod"

import { PERMISSIONS, type Permission } from "@/modules/auth/permissions"
import { emailSchema } from "@/modules/auth/schemas"

const id = z.uuid()
const optionalId = z.uuid().nullable()

export const inviteMemberSchema = z.object({
  email: emailSchema,
  roleId: z.uuid({ error: "validation.required" }),
  teamId: optionalId,
})

export const revokeInvitationSchema = z.object({ id })

export const updateMemberSchema = z.object({
  membershipId: id,
  roleId: id.optional(),
  status: z.enum(["active", "disabled"]).optional(),
})

export const removeMemberSchema = z.object({ membershipId: id })

const teamFields = {
  name: z
    .string()
    .trim()
    .min(2, { error: "validation.nameMin" })
    .max(60, { error: "validation.tooLong" }),
  managerId: optionalId,
  memberIds: z.array(z.uuid()).max(500),
}

export const createTeamSchema = z.object(teamFields)
export const updateTeamSchema = z.object({ id, ...teamFields })
export const deleteTeamSchema = z.object({ id })

const roleFields = {
  name: z
    .string()
    .trim()
    .min(2, { error: "validation.nameMin" })
    .max(60, { error: "validation.tooLong" }),
  description: z.string().trim().max(300, { error: "validation.tooLong" }),
  permissions: z.array(
    z.custom<Permission>(
      (v) => typeof v === "string" && (PERMISSIONS as readonly string[]).includes(v)
    )
  ),
}

export const createRoleSchema = z.object(roleFields)
export const updateRoleSchema = z.object({ id, ...roleFields })
export const deleteRoleSchema = z.object({ id })

export type InviteMemberInput = z.input<typeof inviteMemberSchema>
export type TeamInput = z.input<typeof createTeamSchema>
export type RoleInput = z.input<typeof createRoleSchema>
