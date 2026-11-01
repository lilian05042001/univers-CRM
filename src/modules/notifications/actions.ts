"use server"

import { z } from "zod"

import { createOrgAction } from "@/lib/actions/action"
import { ok } from "@/lib/actions/result"
import { createClient } from "@/lib/supabase/server"

import { NOTIFICATION_TYPES } from "./types"

export type NotificationItem = {
  id: number
  type: (typeof NOTIFICATION_TYPES)[number]
  title: string
  link: string | null
  readAt: string | null
  createdAt: string
}

/** Ultimele notificări ale utilizatorului curent în organizația activă + numărul necitite. */
export const listMyNotifications = createOrgAction({ schema: z.void() }, async (_input, ctx) => {
  const supabase = await createClient()
  const [list, unread] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, title, link, read_at, created_at")
      .eq("organization_id", ctx.organizationId)
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organizationId)
      .eq("user_id", ctx.user.id)
      .is("read_at", null),
  ])
  if (list.error) throw list.error
  if (unread.error) throw unread.error
  return ok({
    unread: unread.count ?? 0,
    items: list.data.map((n): NotificationItem => ({
      id: n.id,
      type: n.type as NotificationItem["type"],
      title: n.title,
      link: n.link,
      readAt: n.read_at,
      createdAt: n.created_at,
    })),
  })
})

/** Marchează ca citite notificările date sau, fără id-uri, pe toate. */
export const markNotificationsRead = createOrgAction(
  { schema: z.object({ ids: z.array(z.number().int()).max(100).optional() }) },
  async ({ ids }, ctx) => {
    const supabase = await createClient()
    let query = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("organization_id", ctx.organizationId)
      .eq("user_id", ctx.user.id)
      .is("read_at", null)
    if (ids) query = query.in("id", ids)
    const { error } = await query
    if (error) throw error
    return ok()
  }
)

export const saveNotificationPreferences = createOrgAction(
  { schema: z.object({ disabled: z.array(z.enum(NOTIFICATION_TYPES)) }) },
  async ({ disabled }, ctx) => {
    // Fără upsert: ar rescrie și cheia (fără drept de UPDATE). Preferințele se rescriu complet.
    const supabase = await createClient()
    const { error: delError } = await supabase
      .from("notification_preferences")
      .delete()
      .eq("organization_id", ctx.organizationId)
      .eq("user_id", ctx.user.id)
    if (delError) throw delError
    const { error } = await supabase.from("notification_preferences").insert(
      NOTIFICATION_TYPES.map((type) => ({
        organization_id: ctx.organizationId,
        user_id: ctx.user.id,
        type,
        in_app: !disabled.includes(type),
      }))
    )
    if (error) throw error
    return ok()
  }
)
