import { z } from "zod"

const name = (max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(max, { error: "validation.tooLong" })

/** Filtrele tablei (aceleași chei ca în URL). */
export const boardFiltersSchema = z.object({
  q: z.string().max(100),
  responsible: z.string().max(40),
  priority: z.string().max(10),
  tag: z.string().max(40),
})
export type BoardFilters = z.infer<typeof boardFiltersSchema>

export const moveCardSchema = z.object({
  leadId: z.uuid(),
  stageId: z.uuid(),
  /** Vecinii din coloana de destinație după mutare (pentru poziție). */
  beforeId: z.uuid().nullable(),
  afterId: z.uuid().nullable(),
  lossReasonId: z.uuid().nullable(),
})

export const loadStageSchema = z.object({
  stageId: z.uuid(),
  offset: z.number().int().min(0).max(100_000),
  filters: boardFiltersSchema,
})

export const pipelineSchema = z.object({ id: z.uuid().optional(), name: name(60) })

export const stageSchema = z.object({
  id: z.uuid().optional(),
  pipelineId: z.uuid(),
  name: name(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, { error: "validation.color" }),
  probability: z
    .string()
    .trim()
    .regex(/^(100|[1-9]?\d)$/, { error: "validation.probability" }),
})

export const reorderStagesSchema = z.object({
  pipelineId: z.uuid(),
  stageIds: z.array(z.uuid()).min(1).max(50),
})

export const ASSIGNMENT_STRATEGIES = ["none", "round_robin", "least_loaded", "fixed"] as const

export const assignmentRuleSchema = z
  .object({
    pipelineId: z.uuid(),
    strategy: z.enum(ASSIGNMENT_STRATEGIES),
    userIds: z.array(z.uuid()).max(100),
  })
  .refine((v) => v.strategy === "none" || v.userIds.length > 0, {
    error: "validation.assignees",
    path: ["userIds"],
  })

export type PipelineInput = z.input<typeof pipelineSchema>
export type StageInput = z.input<typeof stageSchema>
export type AssignmentRuleInput = z.input<typeof assignmentRuleSchema>
