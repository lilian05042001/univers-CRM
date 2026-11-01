import { getSessionUser } from "@/lib/auth/session"
import { getProfile } from "@/modules/profile/queries"

import { UserMenuDropdown } from "./user-menu-dropdown"

export async function UserMenu() {
  const user = await getSessionUser()
  if (!user) return null
  const profile = await getProfile(user.id)

  return <UserMenuDropdown name={profile?.full_name || user.email} email={user.email} />
}
