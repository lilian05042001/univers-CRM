export const TRIGGER_TYPES = [
  "lead.created",
  "lead.stage_entered",
  "lead.won",
  "lead.lost",
  "task.due_soon",
  "lead.inactive",
  "message.received",
] as const
export type TriggerType = (typeof TRIGGER_TYPES)[number]

export const ACTION_TYPES = [
  "assign_responsible",
  "create_task",
  "notify",
  "add_tag",
  "change_stage",
  "require_loss_reason",
  "record_revenue",
] as const
export type ActionType = (typeof ACTION_TYPES)[number]

export const CONDITION_OPERATORS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "is_empty",
  "is_not_empty",
  "includes",
  "not_includes",
] as const
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number]

/** Regulă: câmp din instantaneu („lead.value”, „lead.tags”, „task.priority”), operator, valoare. */
export type ConditionRule = { field: string; operator: ConditionOperator; value?: string }
/** Arbore AND/OR; un grup gol e adevărat. */
export type ConditionGroup = { op: "and" | "or"; rules: (ConditionRule | ConditionGroup)[] }

export type TriggerConfig = { stage_id?: string; minutes?: number; days?: number }

/** Acțiunile se păstrează ca JSON și sunt executate în SQL (private.automation_action). */
export type AutomationAction = { type: ActionType } & Record<string, unknown>

export type Automation = {
  id: string
  organization_id: string
  name: string
  trigger_type: TriggerType
  trigger_config: TriggerConfig
  conditions: ConditionGroup
  actions: AutomationAction[]
  pipeline_id: string | null
}

export type DomainEvent = {
  id: number
  organization_id: string
  type: string
  entity_type: string
  entity_id: string
  payload: Record<string, unknown>
  caused_by_automation_id: string | null
  automation_depth: number
  dedupe_key: string | null
}

/** Datele evaluate de condiții (public.automation_snapshot). */
export type Snapshot = {
  lead: Record<string, unknown> | null
  task: Record<string, unknown> | null
}

/** Înregistrările pe care acționează automatizarea, deduse din eveniment. */
export type EntityRefs = { leadId: string | null; taskId: string | null; contactId: string | null }
