import { z } from "zod"

import { customFieldValuesSchema } from "@/modules/crm-config/custom-fields"

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const
export type Priority = (typeof PRIORITIES)[number]

export const leadSchema = z.object({
  id: z.uuid().optional(),
  title: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(200, { error: "validation.tooLong" }),
  pipelineId: z.uuid({ error: "validation.required" }),
  stageId: z.uuid({ error: "validation.required" }),
  value: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{1,12}([.,]\d{1,2})?$/.test(v.replace(/\s/g, "")), {
      error: "validation.amount",
    }),
  contactId: z.uuid().nullable(),
  // Contact nou, creat odată cu lead-ul (când nu se alege unul existent).
  newContactName: z.string().trim().max(160, { error: "validation.tooLong" }),
  newContactPhone: z
    .string()
    .trim()
    .max(40, { error: "validation.tooLong" })
    .regex(/^[+\d\s()./-]*$/, { error: "validation.phone" }),
  newContactEmail: z
    .string()
    .trim()
    .max(254, { error: "validation.tooLong" })
    .refine((v) => v === "" || z.email().safeParse(v).success, { error: "validation.email" }),
  companyId: z.uuid().nullable(),
  sourceId: z.uuid().nullable(),
  responsibleId: z.uuid().nullable(),
  teamId: z.uuid().nullable(),
  priority: z.enum(PRIORITIES),
  tagIds: z.array(z.uuid()).max(30),
  description: z.string().trim().max(10000, { error: "validation.tooLong" }),
  lossReasonId: z.uuid().nullable(),
  lossComment: z.string().trim().max(1000, { error: "validation.tooLong" }),
  customFields: customFieldValuesSchema,
})

export type LeadInput = z.input<typeof leadSchema>

export const LEAD_SORT_KEYS = [
  "created_at",
  "value",
  "title",
  "last_activity_at",
  "next_task_due_at",
] as const

/** „12 500,50” → 12500.5 */
export function parseAmount(value: string): number {
  const n = Number(value.replace(/\s/g, "").replace(",", "."))
  return Number.isFinite(n) ? n : 0
}
