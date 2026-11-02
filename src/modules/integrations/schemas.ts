import { z } from "zod"

import { API_SCOPES } from "@/lib/api/scopes"

export const API_KEY_EXPIRY = ["never", "30", "90", "365"] as const

export const apiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(100, { error: "validation.tooLong" }),
  scopes: z.array(z.enum(API_SCOPES)).min(1, { error: "validation.scopes" }),
  expiresIn: z.enum(API_KEY_EXPIRY),
})

export type ApiKeyInput = z.input<typeof apiKeySchema>
