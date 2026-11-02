import { z } from "zod"

import { IMPORT_ENTITIES, IMPORT_LIMITS } from "./fields"

export const startImportSchema = z.object({
  entity: z.enum(IMPORT_ENTITIES),
  fileName: z.string().trim().min(1).max(255),
  totalRows: z.number().int().min(1).max(IMPORT_LIMITS.maxRows),
  /** Coloana din fișier → câmpul ales (pentru istoricul jobului). */
  mapping: z.record(z.string().max(200), z.string().max(100)),
  skipDuplicates: z.boolean(),
  createCompanies: z.boolean(),
  defaultOwnerId: z.uuid().nullable(),
})

export type StartImportInput = z.input<typeof startImportSchema>

export const importBatchSchema = z.object({
  jobId: z.uuid(),
  rows: z
    .array(
      z.object({
        row: z.number().int().min(2),
        values: z.record(z.string().max(100), z.string().max(2000)),
      })
    )
    .min(1)
    .max(IMPORT_LIMITS.batchSize),
})

export const finishImportSchema = z.object({
  jobId: z.uuid(),
  status: z.enum(["done", "failed", "cancelled"]),
})
