import { z } from "zod"

/** Înregistrarea-părinte a unei note / sarcini / fișier / activități. */
export const RECORD_ENTITIES = ["lead", "contact", "company"] as const
export type RecordEntity = (typeof RECORD_ENTITIES)[number]

export const recordRefSchema = z.object({ entity: z.enum(RECORD_ENTITIES), id: z.uuid() })
export type RecordRef = z.infer<typeof recordRefSchema>

/** Coloana FK corespunzătoare entității („lead” → „lead_id”). */
export const refColumn = (entity: RecordEntity) => `${entity}_id` as const

/** Câmpurile FK pentru inserare: { lead_id: "..." }. */
export const refFields = (ref: RecordRef) =>
  ({ [refColumn(ref.entity)]: ref.id }) as Record<`${RecordEntity}_id`, string>

export const recordHref = (ref: RecordRef) =>
  ({ lead: `/leads/${ref.id}`, contact: `/contacts/${ref.id}`, company: `/companies/${ref.id}` })[
    ref.entity
  ]
