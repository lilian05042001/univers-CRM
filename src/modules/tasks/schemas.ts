import { z } from "zod"

import { recordRefSchema } from "@/lib/crm/record-ref"

export const TASK_STATUSES = ["new", "in_progress", "done", "cancelled"] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const taskSchema = z.object({
  id: z.uuid().optional(),
  title: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(200, { error: "validation.tooLong" }),
  description: z.string().trim().max(5000, { error: "validation.tooLong" }),
  typeId: z.uuid({ error: "validation.required" }),
  responsibleId: z.uuid().nullable(),
  /** Data și ora locală din formular („2026-11-05T14:30”). */
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: "validation.dateTime" }),
  durationMinutes: z.string().regex(/^\d{0,4}$/, { error: "validation.number" }),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  ref: recordRefSchema.nullable(),
})

export type TaskInput = z.input<typeof taskSchema>

export const taskStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(TASK_STATUSES),
  result: z.string().trim().max(2000).optional(),
})
