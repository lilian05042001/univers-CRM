"use server"

import { z } from "zod"

import { createAction } from "@/lib/actions/action"
import { ok } from "@/lib/actions/result"
import { getSessionUser } from "@/lib/auth/session"
import { locales } from "@/lib/i18n/config"
import { setLocaleCookie } from "@/lib/i18n/cookie"
import { createClient } from "@/lib/supabase/server"

/** Schimbă limba interfeței; pentru utilizatorul autentificat se păstrează și în profil. */
export const changeLocale = createAction(
  z.object({ locale: z.enum(locales) }),
  async ({ locale }) => {
    const user = await getSessionUser()
    if (user) {
      const supabase = await createClient()
      const { error } = await supabase.from("profiles").update({ locale }).eq("id", user.id)
      if (error) throw error
    }
    await setLocaleCookie(locale)
    return ok()
  }
)
