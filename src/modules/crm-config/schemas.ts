import { z } from "zod"

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "validation.color" })
const name = (max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(max, { error: "validation.tooLong" })

export const TAG_COLORS = [
  "#64748b",
  "#3b82f6",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#8b5cf6",
  "#0ea5e9",
  "#db2777",
]

export const tagSchema = z.object({ id: z.uuid().optional(), name: name(40), color })

export const SOURCE_CHANNELS = [
  "manual",
  "web_form",
  "whatsapp",
  "instagram",
  "messenger",
  "email",
  "phone",
  "referral",
  "import",
  "api",
  "other",
] as const

export const sourceSchema = z.object({
  id: z.uuid().optional(),
  name: name(60),
  channel: z.enum(SOURCE_CHANNELS),
  isActive: z.boolean(),
})

export const FIELD_ENTITIES = ["lead", "contact", "company"] as const
export const FIELD_TYPES = [
  "text",
  "number",
  "date",
  "select",
  "multiselect",
  "bool",
  "url",
] as const

export const customFieldSchema = z
  .object({
    id: z.uuid().optional(),
    entity: z.enum(FIELD_ENTITIES),
    label: name(60),
    type: z.enum(FIELD_TYPES),
    /** O opțiune pe rând (pentru select / multiselect). */
    options: z.string().max(4000, { error: "validation.tooLong" }),
    isRequired: z.boolean(),
  })
  .refine(
    (v) => !["select", "multiselect"].includes(v.type) || splitOptions(v.options).length > 0,
    {
      error: "validation.optionsRequired",
      path: ["options"],
    }
  )

export function splitOptions(value: string): string[] {
  return [
    ...new Set(
      value
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean)
    ),
  ].slice(0, 100)
}

export const deleteByIdSchema = z.object({ id: z.uuid() })

export type TagInput = z.input<typeof tagSchema>
export type SourceInput = z.input<typeof sourceSchema>
export type CustomFieldInput = z.input<typeof customFieldSchema>
