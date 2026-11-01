import { getSessionUser } from "@/lib/auth/session"

import { NotificationBell } from "./notification-bell"

/** Server wrapper: clopoțelul are nevoie de utilizator pentru abonarea Realtime. */
export async function NotificationBellSlot() {
  const user = await getSessionUser()
  return user ? <NotificationBell userId={user.id} /> : null
}
