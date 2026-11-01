import { z } from "zod"

export const CURRENCIES = ["MDL", "RON", "EUR", "USD"] as const
export const TIMEZONES = [
  "Europe/Chisinau",
  "Europe/Bucharest",
  "Europe/Kyiv",
  "Europe/Moscow",
  "UTC",
] as const
export const LOCALES = ["ro", "en", "ru"] as const

// Fără .transform(): schemele sunt folosite și de formulare, unde intrarea = ieșirea.
// Șirurile goale devin null în acțiunea de pe server (emptyToNull).
const optionalText = (max: number) => z.string().trim().max(max, { error: "validation.tooLong" })

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, { error: "validation.nameMin" })
  .max(120, { error: "validation.tooLong" })

export const createOrganizationSchema = z.object({ name: organizationNameSchema })

export const switchOrganizationSchema = z.object({ organizationId: z.uuid() })

export const acceptInvitationSchema = z.object({ token: z.string().min(20).max(100) })

export const companySettingsSchema = z.object({
  name: organizationNameSchema,
  legalName: optionalText(200),
  fiscalCode: optionalText(32),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, { error: "validation.country" }),
  currency: z.enum(CURRENCIES),
  timezone: z.enum(TIMEZONES),
  defaultLocale: z.enum(LOCALES),
})

export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>
export type CompanySettingsInput = z.input<typeof companySettingsSchema>
