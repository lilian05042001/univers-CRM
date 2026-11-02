import type { ConditionGroup, ConditionRule, Snapshot } from "./types"

const isGroup = (x: ConditionRule | ConditionGroup): x is ConditionGroup => "rules" in x

/** Valoarea unui câmp din instantaneu: „lead.value”, „lead.custom_fields.buget”, „task.priority”. */
export function readField(snapshot: Snapshot, field: string): unknown {
  let current: unknown = snapshot
  for (const part of field.split(".")) {
    if (current === null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)

const toNumber = (v: unknown) => (typeof v === "number" ? v : Number(String(v).replace(",", ".")))

export function evaluateRule(rule: ConditionRule, snapshot: Snapshot): boolean {
  const actual = readField(snapshot, rule.field)
  const expected = rule.value ?? ""

  switch (rule.operator) {
    case "is_empty":
      return isEmpty(actual)
    case "is_not_empty":
      return !isEmpty(actual)
    case "includes":
      return Array.isArray(actual) && actual.map(String).includes(expected)
    case "not_includes":
      return !Array.isArray(actual) || !actual.map(String).includes(expected)
    case "contains":
      return String(actual ?? "")
        .toLocaleLowerCase("ro")
        .includes(expected.toLocaleLowerCase("ro"))
    case "eq":
      return !isEmpty(actual) && String(actual) === expected
    case "neq":
      return isEmpty(actual) || String(actual) !== expected
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      if (isEmpty(actual) || expected === "") return false
      const a = toNumber(actual)
      const b = toNumber(expected)
      if (Number.isNaN(a) || Number.isNaN(b)) return false
      return rule.operator === "gt"
        ? a > b
        : rule.operator === "gte"
          ? a >= b
          : rule.operator === "lt"
            ? a < b
            : a <= b
    }
  }
}

/** Arborele de condiții: AND = toate, OR = cel puțin una; un grup gol trece. */
export function evaluateConditions(
  group: ConditionGroup | null | undefined,
  snapshot: Snapshot
): boolean {
  if (!group || !Array.isArray(group.rules) || group.rules.length === 0) return true
  const results = group.rules.map((r) =>
    isGroup(r) ? evaluateConditions(r, snapshot) : evaluateRule(r, snapshot)
  )
  return group.op === "or" ? results.some(Boolean) : results.every(Boolean)
}
