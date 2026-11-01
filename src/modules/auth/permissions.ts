// Oglinda catalogului din SQL: private.permission_catalog() (supabase/migrations/*_core_tenancy.sql).
// Orice permisiune nouă se adaugă în ambele locuri, în aceeași migrație.
export const PERMISSION_GROUPS = {
  crm: ["crm.view.all", "crm.view.team"],
  leads: ["leads.create", "leads.edit", "leads.delete", "leads.assign"],
  contacts: ["contacts.create", "contacts.edit", "contacts.delete"],
  inbox: ["inbox.view.all"],
  reports: ["reports.view.all", "reports.view.team"],
  data: ["data.import", "data.export"],
  configuration: ["pipelines.manage", "automations.manage"],
  administration: ["team.manage", "roles.manage", "settings.manage", "api_keys.manage"],
} as const

export type PermissionGroup = keyof typeof PERMISSION_GROUPS
export type Permission = (typeof PERMISSION_GROUPS)[PermissionGroup][number]

export const PERMISSIONS: readonly Permission[] = Object.values(PERMISSION_GROUPS).flat()

export const ADMIN_ROLE_KEY = "admin"

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value)
}

/** Administratorul are implicit toate permisiunile (la fel ca private.has_perm în SQL). */
export function roleHasPermission(
  role: { key: string; permissions: readonly string[] },
  permission: Permission
): boolean {
  return role.key === ADMIN_ROLE_KEY || role.permissions.includes(permission)
}
