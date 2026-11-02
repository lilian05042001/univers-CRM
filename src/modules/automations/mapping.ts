import type {
  AutomationAction,
  ConditionGroup,
  ConditionRule,
  TriggerConfig,
  TriggerType,
} from "@/lib/automation-engine/types"

import { emptyAction, type ActionInput, type AutomationInput } from "./schemas"

/** Doar câmpurile relevante pentru tipul acțiunii, cu numerele convertite (JSON-ul executat în SQL). */
export function actionToJson(a: ActionInput): AutomationAction {
  switch (a.type) {
    case "assign_responsible":
      return { type: a.type, strategy: a.strategy, user_ids: a.user_ids }
    case "create_task":
      return {
        type: a.type,
        title: a.title,
        task_type_id: a.task_type_id,
        due_in_hours: Number(a.due_in_hours || 24),
        assignee: a.assignee,
        user_id: a.assignee === "user" ? a.user_id : null,
        priority: a.priority,
      }
    case "notify":
      return {
        type: a.type,
        recipient: a.recipient,
        user_id: a.recipient === "user" ? a.user_id : null,
        message: a.message,
      }
    case "add_tag":
      return { type: a.type, tag_id: a.tag_id }
    case "change_stage":
      return { type: a.type, stage_id: a.stage_id }
    default:
      return { type: a.type }
  }
}

export function actionFromJson(json: AutomationAction): ActionInput {
  const base = emptyAction(json.type)
  const s = (k: string) => (typeof json[k] === "string" ? (json[k] as string) : null)
  return {
    ...base,
    strategy: (s("strategy") as ActionInput["strategy"]) ?? base.strategy,
    user_ids: Array.isArray(json.user_ids) ? json.user_ids.map(String) : [],
    title: s("title") ?? "",
    task_type_id: s("task_type_id"),
    due_in_hours: json.due_in_hours != null ? String(json.due_in_hours) : base.due_in_hours,
    assignee: (s("assignee") as ActionInput["assignee"]) ?? base.assignee,
    recipient: (s("recipient") as ActionInput["recipient"]) ?? base.recipient,
    user_id: s("user_id"),
    priority: (s("priority") as ActionInput["priority"]) ?? base.priority,
    message: s("message") ?? "",
    tag_id: s("tag_id"),
    stage_id: s("stage_id"),
  }
}

export function triggerConfigToJson(input: AutomationInput): TriggerConfig {
  switch (input.triggerType) {
    case "lead.stage_entered":
      return { stage_id: input.stageId ?? undefined }
    case "task.due_soon":
      return { minutes: Number(input.minutes) }
    case "lead.inactive":
      return { days: Number(input.days) }
    default:
      return {}
  }
}

export function conditionsToJson(input: AutomationInput): ConditionGroup {
  return { op: input.conditionOp, rules: input.rules.map((r) => ({ ...r })) }
}

export type AutomationRecord = {
  id: string
  name: string
  description: string | null
  trigger_type: TriggerType
  trigger_config: TriggerConfig
  conditions: ConditionGroup
  actions: AutomationAction[]
  pipeline_id: string | null
  is_active: boolean
}

/** Editorul afișează un singur nivel de reguli (structura din DB permite și grupuri imbricate). */
export function toFormValues(record: AutomationRecord | null): AutomationInput {
  const rules = (record?.conditions?.rules ?? []).filter((r): r is ConditionRule => !("rules" in r))
  return {
    id: record?.id,
    name: record?.name ?? "",
    description: record?.description ?? "",
    triggerType: record?.trigger_type ?? "lead.created",
    stageId: record?.trigger_config.stage_id ?? null,
    minutes: String(record?.trigger_config.minutes ?? 60),
    days: String(record?.trigger_config.days ?? 7),
    pipelineId: record?.pipeline_id ?? null,
    conditionOp: record?.conditions?.op ?? "and",
    rules: rules.map((r) => ({ field: r.field, operator: r.operator, value: r.value ?? "" })),
    actions: record ? record.actions.map(actionFromJson) : [emptyAction("create_task")],
    isActive: record?.is_active ?? true,
  }
}
