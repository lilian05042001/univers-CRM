import { z } from "zod"

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { error: "validation.nameMin" })
    .max(120, { error: "validation.tooLong" }),
  phone: z
    .string()
    .trim()
    .max(32, { error: "validation.tooLong" })
    .regex(/^[+\d\s()-]*$/, { error: "validation.phone" }),
})

export type ProfileInput = z.input<typeof profileSchema>
