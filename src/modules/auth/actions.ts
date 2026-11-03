"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { createAction } from "@/lib/actions/action"
import { fail, ok } from "@/lib/actions/result"
import { safeNextPath } from "@/lib/auth/routes"
import { clearActiveOrganization } from "@/lib/auth/session"
import { env } from "@/lib/env"
import { isLocale } from "@/lib/i18n/config"
import { currentLocale, setLocaleCookie } from "@/lib/i18n/cookie"
import { authAttemptAllowed } from "@/lib/security/rate-limit"
import { createClient } from "@/lib/supabase/server"

import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./schemas"

function callbackUrl(next: string) {
  return `${env.appUrl}/auth/callback?next=${encodeURIComponent(next)}`
}

export const login = createAction(loginSchema, async ({ email, password, next }) => {
  if (!(await authAttemptAllowed("login", email))) return fail("errors.auth.rateLimited")
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.code === "email_not_confirmed") return fail("errors.auth.emailNotConfirmed")
    if (error.code === "invalid_credentials") return fail("errors.auth.invalidCredentials")
    if (error.status === 429) return fail("errors.auth.rateLimited")
    throw error
  }
  // Limba aleasă în profil se aplică pe orice dispozitiv, de la autentificare.
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", data.user.id)
    .maybeSingle()
  if (isLocale(profile?.locale)) await setLocaleCookie(profile.locale)
  redirect(safeNextPath(next))
})

export const register = createAction(
  registerSchema,
  async ({ fullName, email, password, next }) => {
    if (!(await authAttemptAllowed("register"))) return fail("errors.auth.rateLimited")
    const supabase = await createClient()
    const target = safeNextPath(next, "/onboarding")
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Limba interfeței de la înregistrare devine limba profilului.
      options: {
        data: { full_name: fullName, locale: await currentLocale() },
        emailRedirectTo: callbackUrl(target),
      },
    })

    if (error) {
      if (error.code === "weak_password") return fail("errors.auth.weakPassword")
      if (error.status === 429) return fail("errors.auth.rateLimited")
      // user_already_exists nu se dezvăluie (evită enumerarea conturilor).
      if (error.code !== "user_already_exists") throw error
    }

    // Cu confirmarea e-mailului dezactivată, sesiunea există deja.
    if (data?.session) redirect(target)
    return ok({ needsConfirmation: true })
  }
)

export const requestPasswordReset = createAction(forgotPasswordSchema, async ({ email }) => {
  if (!(await authAttemptAllowed("reset", email))) return fail("errors.auth.rateLimited")
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl("/reset-password"),
  })
  if (error?.status === 429) return fail("errors.auth.rateLimited")
  // Răspuns identic indiferent dacă adresa există.
  return ok()
})

export const updatePassword = createAction(resetPasswordSchema, async ({ password }) => {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    if (error.code === "same_password") return fail("errors.auth.samePassword")
    if (error.code === "weak_password") return fail("errors.auth.weakPassword")
    if (error.code === "session_not_found" || error.status === 401) {
      return fail("errors.auth.sessionExpired")
    }
    throw error
  }
  return ok()
})

export const signOut = createAction(z.void(), async () => {
  const supabase = await createClient()
  await supabase.auth.signOut()
  await clearActiveOrganization()
  redirect("/login")
})
