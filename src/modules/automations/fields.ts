import type { ConditionOperator } from "@/lib/automation-engine/types"
import type { CrmOptions, NamedOption } from "@/modules/crm-config/types"

/** Tipul valorii unui câmp de condiție: decide operatorii și controlul pentru valoare. */
export type FieldKind =
  "number" | "text" | "priority" | "source" | "member" | "team" | "tag" | "stage"

export type ConditionField = { key: string; kind: FieldKind }

export const CONDITION_FIELDS: ConditionField[] = [
  { key: "lead.value", kind: "number" },
  { key: "lead.priority", kind: "priority" },
  { key: "lead.source_id", kind: "source" },
  { key: "lead.responsible_id", kind: "member" },
  { key: "lead.team_id", kind: "team" },
  { key: "lead.stage_id", kind: "stage" },
  { key: "lead.tags", kind: "tag" },
  { key: "lead.title", kind: "text" },
  { key: "task.priority", kind: "priority" },
]

export const OPERATORS_BY_KIND: Record<FieldKind, ConditionOperator[]> = {
  number: ["eq", "neq", "gt", "gte", "lt", "lte"],
  text: ["contains", "eq", "neq", "is_empty", "is_not_empty"],
  priority: ["eq", "neq"],
  source: ["eq", "neq", "is_empty", "is_not_empty"],
  member: ["eq", "neq", "is_empty", "is_not_empty"],
  team: ["eq", "neq", "is_empty", "is_not_empty"],
  stage: ["eq", "neq"],
  tag: ["includes", "not_includes"],
}

export const NO_VALUE_OPERATORS: ConditionOperator[] = ["is_empty", "is_not_empty"]

/** next-intl folosește „.” pentru niveluri: „lead.created” → cheia „lead_created”. */
export const i18nKey = (key: string) => key.replaceAll(".", "_")

export const fieldKind = (key: string): FieldKind =>
  CONDITION_FIELDS.find((f) => f.key === key)?.kind ?? "text"

export type EditorOptions = Pick<
  CrmOptions,
  "pipelines" | "sources" | "tags" | "members" | "teams"
> & {
  taskTypes: NamedOption[]
}

/** Opțiunile unei valori (pentru câmpurile cu listă), sau null pentru text / număr. */
export function valueOptions(
  kind: FieldKind,
  options: EditorOptions,
  priorityLabel: (p: string) => string
): { value: string; label: string }[] | null {
  switch (kind) {
    case "priority":
      return ["low", "normal", "high", "urgent"].map((p) => ({ value: p, label: priorityLabel(p) }))
    case "source":
      return options.sources.map((s) => ({ value: s.id, label: s.name }))
    case "member":
      return options.members.map((m) => ({ value: m.id, label: m.name }))
    case "team":
      return options.teams.map((t) => ({ value: t.id, label: t.name }))
    case "tag":
      return options.tags.map((t) => ({ value: t.id, label: t.name }))
    case "stage":
      return options.pipelines.flatMap((p) =>
        p.stages.map((s) => ({
          value: s.id,
          label: options.pipelines.length > 1 ? `${p.name} · ${s.name}` : s.name,
        }))
      )
    default:
      return null
  }
}
