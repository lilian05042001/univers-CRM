import { z } from "zod"

import { ACTION_TYPES, CONDITION_OPERATORS, TRIGGER_TYPES } from "@/lib/automation-engine/types"

export const ASSIGN_STRATEGIES = ["round_robin", "least_loaded", "fixed"] as const
export const TASK_ASSIGNEES = ["lead_responsible", "user"] as const
export const NOTIFY_RECIPIENTS = ["responsible", "user"] as const
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const

const intString = (max: number) =>
  z
    .string()
    .regex(/^\d{0,5}$/, { error: "validation.number" })
    .refine((v) => !v || Number(v) <= max, {
      error: "validation.number",
    })

export const conditionRuleSchema = z.object({
  field: z.string().min(1, { error: "validation.required" }).max(100),
  operator: z.enum(CONDITION_OPERATORS),
  value: z.string().max(200),
})

/** Formă plată pentru toate tipurile de acțiuni (câmpurile nefolosite de tip se ignoră la salvare). */
export const actionSchema = z
  .object({
    type: z.enum(ACTION_TYPES),
    strategy: z.enum(ASSIGN_STRATEGIES),
    user_ids: z.array(z.uuid()).max(50),
    title: z.string().trim().max(200, { error: "validation.tooLong" }),
    task_type_id: z.uuid().nullable(),
    due_in_hours: intString(8760),
    assignee: z.enum(TASK_ASSIGNEES),
    recipient: z.enum(NOTIFY_RECIPIENTS),
    user_id: z.uuid().nullable(),
    priority: z.enum(PRIORITIES),
    message: z.string().trim().max(200, { error: "validation.tooLong" }),
    tag_id: z.uuid().nullable(),
    stage_id: z.uuid().nullable(),
  })
  .superRefine((a, ctx) => {
    const required = (path: string, ok: boolean, error = "validation.required") => {
      if (!ok) ctx.addIssue({ code: "custom", path: [path], message: error })
    }
    if (a.type === "assign_responsible")
      required("user_ids", a.user_ids.length > 0, "validation.assignees")
    if (a.type === "create_task") {
      required("title", a.title.length > 0)
      required("user_id", a.assignee !== "user" || a.user_id !== null)
    }
    if (a.type === "notify") required("user_id", a.recipient !== "user" || a.user_id !== null)
    if (a.type === "add_tag") required("tag_id", a.tag_id !== null)
    if (a.type === "change_stage") required("stage_id", a.stage_id !== null)
  })
export type ActionInput = z.input<typeof actionSchema>

export const automationSchema = z
  .object({
    id: z.uuid().optional(),
    name: z
      .string()
      .trim()
      .min(1, { error: "validation.required" })
      .max(120, { error: "validation.tooLong" }),
    description: z.string().trim().max(500, { error: "validation.tooLong" }),
    triggerType: z.enum(TRIGGER_TYPES),
    stageId: z.uuid().nullable(),
    minutes: intString(10080),
    days: intString(365),
    pipelineId: z.uuid().nullable(),
    conditionOp: z.enum(["and", "or"]),
    rules: z.array(conditionRuleSchema).max(20),
    actions: z.array(actionSchema).min(1, { error: "validation.required" }).max(10),
    isActive: z.boolean(),
  })
  .superRefine((a, ctx) => {
    if (a.triggerType === "lead.stage_entered" && !a.stageId) {
      ctx.addIssue({ code: "custom", path: ["stageId"], message: "validation.required" })
    }
    if (a.triggerType === "task.due_soon" && !Number(a.minutes)) {
      ctx.addIssue({ code: "custom", path: ["minutes"], message: "validation.number" })
    }
    if (a.triggerType === "lead.inactive" && !Number(a.days)) {
      ctx.addIssue({ code: "custom", path: ["days"], message: "validation.number" })
    }
  })
export type AutomationInput = z.input<typeof automationSchema>

export const RUN_STATUSES = ["success", "skipped", "failed", "running"] as const
export type RunStatus = (typeof RUN_STATUSES)[number]

export const emptyAction = (type: ActionInput["type"]): ActionInput => ({
  type,
  strategy: "round_robin",
  user_ids: [],
  title: "",
  task_type_id: null,
  due_in_hours: "24",
  assignee: "lead_responsible",
  recipient: "responsible",
  user_id: null,
  priority: "normal",
  message: "",
  tag_id: null,
  stage_id: null,
})
