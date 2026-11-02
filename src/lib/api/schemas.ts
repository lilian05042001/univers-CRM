import { z } from "zod"

const nullableText = (max: number) => z.string().trim().max(max).nullable()
const uuidOrNull = z.uuid().nullable()

const phone = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[+\d\s()./-]+$/, { error: "invalid_phone" })

const customFields = z.record(
  z.string().max(100),
  z.union([
    z.string().max(2000),
    z.number(),
    z.boolean(),
    z.array(z.string().max(200)).max(50),
    z.null(),
  ])
)

const address = z.object({
  city: z.string().trim().max(100).optional(),
  street: z.string().trim().max(200).optional(),
})

export const contactInput = z
  .object({
    first_name: z.string().trim().max(80),
    last_name: z.string().trim().max(80),
    position: nullableText(100),
    company_id: uuidOrNull,
    source_id: uuidOrNull,
    owner_id: uuidOrNull,
    phones: z.array(phone).max(10),
    emails: z.array(z.email().max(254)).max(10),
    address,
    tag_ids: z.array(z.uuid()).max(30),
    custom_fields: customFields,
  })
  .partial()
  .strict()

export type ContactInput = z.output<typeof contactInput>

export const companyInput = z
  .object({
    name: z.string().trim().min(1).max(200),
    industry: nullableText(100),
    phone: phone.nullable(),
    email: z.email().max(254).nullable(),
    website: z.url().max(300).nullable(),
    owner_id: uuidOrNull,
    address,
    tag_ids: z.array(z.uuid()).max(30),
    custom_fields: customFields,
  })
  .partial()
  .strict()

export type CompanyInput = z.output<typeof companyInput>

export const LEAD_PRIORITIES = ["low", "normal", "high", "urgent"] as const

export const leadInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    pipeline_id: z.uuid(),
    stage_id: z.uuid(),
    value: z.number().min(0).max(999_999_999_999),
    currency: z.string().regex(/^[A-Z]{3}$/),
    company_id: uuidOrNull,
    contact_ids: z.array(z.uuid()).max(10),
    source_id: uuidOrNull,
    responsible_id: uuidOrNull,
    team_id: uuidOrNull,
    priority: z.enum(LEAD_PRIORITIES),
    description: nullableText(10_000),
    loss_reason_id: uuidOrNull,
    tag_ids: z.array(z.uuid()).max(30),
    custom_fields: customFields,
  })
  .partial()
  .strict()

export type LeadInput = z.output<typeof leadInput>
