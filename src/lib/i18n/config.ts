export const locales = ["ro", "en", "ru"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "ro"

/** Cookie-ul cu limba aleasă (profil, pagina de autentificare); citit de proxy. */
export const LOCALE_COOKIE = "NEXT_LOCALE"

export function isLocale(value: string | null | undefined): value is Locale {
  return (locales as readonly string[]).includes(value ?? "")
}

/** Limba preferată din antetul Accept-Language („ru-RU,ru;q=0.9,en;q=0.8” → ru). */
export function localeFromAcceptLanguage(header: string | null): Locale | null {
  const ranked = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";")
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1)
      return { language: tag.toLowerCase().split("-")[0]!, q: Number.isFinite(q) ? q : 0 }
    })
    .filter((l) => l.q > 0)
    .sort((a, b) => b.q - a.q)
  return ranked.map((l) => l.language).find(isLocale) ?? null
}

/** Limba unei cereri: alegerea salvată (cookie) → Accept-Language → ro. */
export function resolveLocale(
  cookie: string | null | undefined,
  acceptLanguage: string | null
): Locale {
  return isLocale(cookie) ? cookie : (localeFromAcceptLanguage(acceptLanguage) ?? defaultLocale)
}
