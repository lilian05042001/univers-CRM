import { z } from "zod"

import { customFieldValuesSchema } from "@/modules/crm-config/custom-fields"

export const companySchema = z.object({
  id: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(200, { error: "validation.tooLong" }),
  industry: z.string().trim().max(100, { error: "validation.tooLong" }),
  phone: z
    .string()
    .trim()
    .max(40, { error: "validation.tooLong" })
    .regex(/^[+\d\s()./-]*$/, { error: "validation.phone" }),
  email: z
    .string()
    .trim()
    .max(254, { error: "validation.tooLong" })
    .refine((v) => v === "" || z.email().safeParse(v).success, { error: "validation.email" }),
  website: z
    .string()
    .trim()
    .max(300, { error: "validation.tooLong" })
    .refine((v) => v === "" || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v), {
      error: "validation.url",
    }),
  ownerId: z.uuid().nullable(),
  tagIds: z.array(z.uuid()).max(30),
  city: z.string().trim().max(100, { error: "validation.tooLong" }),
  street: z.string().trim().max(200, { error: "validation.tooLong" }),
  customFields: customFieldValuesSchema,
})

export type CompanyInput = z.input<typeof companySchema>

export const companyDuplicateCheckSchema = z.object({
  name: z.string().max(200),
  phone: z.string().max(40),
  email: z.string().max(254),
  excludeId: z.uuid().nullable(),
})

export const COMPANY_SORT_KEYS = ["created_at", "name"] as const
