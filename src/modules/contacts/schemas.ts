import { z } from "zod"

import { customFieldValuesSchema } from "@/modules/crm-config/custom-fields"

const emailValue = z
  .string()
  .trim()
  .max(254, { error: "validation.tooLong" })
  .refine((v) => v === "" || z.email().safeParse(v).success, { error: "validation.email" })

const phoneValue = z
  .string()
  .trim()
  .max(40, { error: "validation.tooLong" })
  .regex(/^[+\d\s()./-]*$/, { error: "validation.phone" })

export const contactSchema = z
  .object({
    id: z.uuid().optional(),
    firstName: z.string().trim().max(80, { error: "validation.tooLong" }),
    lastName: z.string().trim().max(80, { error: "validation.tooLong" }),
    phones: z.array(z.object({ value: phoneValue })).max(10),
    emails: z.array(z.object({ value: emailValue })).max(10),
    companyId: z.uuid().nullable(),
    position: z.string().trim().max(100, { error: "validation.tooLong" }),
    sourceId: z.uuid().nullable(),
    ownerId: z.uuid().nullable(),
    tagIds: z.array(z.uuid()).max(30),
    city: z.string().trim().max(100, { error: "validation.tooLong" }),
    street: z.string().trim().max(200, { error: "validation.tooLong" }),
    customFields: customFieldValuesSchema,
  })
  .refine((v) => `${v.firstName}${v.lastName}`.trim() !== "", {
    error: "validation.contactName",
    path: ["firstName"],
  })

export type ContactInput = z.input<typeof contactSchema>

export const duplicateCheckSchema = z.object({
  phones: z.array(z.string().max(40)).max(10),
  emails: z.array(z.string().max(254)).max(10),
  excludeId: z.uuid().nullable(),
})

export const mergeContactsSchema = z.object({ keepId: z.uuid(), removeId: z.uuid() })

export const CONTACT_SORT_KEYS = ["created_at", "full_name"] as const
