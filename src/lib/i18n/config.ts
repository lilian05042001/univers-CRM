export const locales = ["ro", "en", "ru"] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = "ro"
