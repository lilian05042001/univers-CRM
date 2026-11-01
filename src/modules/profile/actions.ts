"use server"

import { createAction } from "@/lib/actions/action"
import { ok } from "@/lib/actions/result"
import { requireUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { emptyToNull } from "@/lib/utils/format"

import { profileSchema } from "./schemas"

export const updateProfile = createAction(profileSchema, async ({ fullName, phone }) => {
  const user = await requireUser()
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: emptyToNull(phone) })
    .eq("id", user.id)
  if (error) throw error
  return ok()
})
