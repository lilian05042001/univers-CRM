import "server-only"

import { cookies, headers } from "next/headers"

import { LOCALE_COOKIE, resolveLocale, type Locale } from "./config"

/** Limba aleasă devine cookie: proxy-ul servește cererile următoare în limba respectivă. */
export async function setLocaleCookie(locale: Locale) {
  ;(await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  })
}

/** Limba cererii curente în Server Actions (unde next/root-params nu e disponibil). */
export async function currentLocale(): Promise<Locale> {
  return resolveLocale(
    (await cookies()).get(LOCALE_COOKIE)?.value,
    (await headers()).get("accept-language")
  )
}
