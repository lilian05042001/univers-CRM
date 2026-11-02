import { describe, expect, it } from "vitest"

import { evaluateConditions, evaluateRule } from "@/lib/automation-engine/conditions"
import { processBatch, type EngineStore } from "@/lib/automation-engine/engine"
import { dedupeKey, entityRefs, loopReason, matchesTrigger } from "@/lib/automation-engine/triggers"
import type { Automation, DomainEvent, Snapshot } from "@/lib/automation-engine/types"
import { actionToJson, toFormValues } from "@/modules/automations/mapping"
import { automationSchema, emptyAction } from "@/modules/automations/schemas"

const ORG = "00000000-0000-4000-8000-000000000001"
const STAGE = "00000000-0000-4000-8000-0000000000aa"

const automation = (overrides: Partial<Automation> = {}): Automation => ({
  id: "auto-1",
  organization_id: ORG,
  name: "Test",
  trigger_type: "lead.created",
  trigger_config: {},
  conditions: { op: "and", rules: [] },
  actions: [{ type: "notify" }],
  pipeline_id: null,
  ...overrides,
})

const event = (overrides: Partial<DomainEvent> = {}): DomainEvent => ({
  id: 1,
  organization_id: ORG,
  type: "lead.created",
  entity_type: "lead",
  entity_id: "lead-1",
  payload: {},
  caused_by_automation_id: null,
  automation_depth: 0,
  dedupe_key: null,
  ...overrides,
})

const snapshot: Snapshot = {
  lead: { value: 15000, priority: "high", tags: ["vip"], title: "Licențe CRM", source_id: null },
  task: null,
}

describe("conditions", () => {
  it("compares numbers, texts, lists and empty values", () => {
    expect(evaluateRule({ field: "lead.value", operator: "gte", value: "10000" }, snapshot)).toBe(
      true
    )
    expect(evaluateRule({ field: "lead.value", operator: "lt", value: "10000" }, snapshot)).toBe(
      false
    )
    expect(evaluateRule({ field: "lead.priority", operator: "eq", value: "high" }, snapshot)).toBe(
      true
    )
    expect(
      evaluateRule({ field: "lead.title", operator: "contains", value: "crm" }, snapshot)
    ).toBe(true)
    expect(evaluateRule({ field: "lead.tags", operator: "includes", value: "vip" }, snapshot)).toBe(
      true
    )
    expect(
      evaluateRule({ field: "lead.tags", operator: "not_includes", value: "vip" }, snapshot)
    ).toBe(false)
    expect(evaluateRule({ field: "lead.source_id", operator: "is_empty" }, snapshot)).toBe(true)
  })

  it("treats a missing record as not matching value comparisons", () => {
    const empty: Snapshot = { lead: null, task: null }
    expect(evaluateRule({ field: "lead.value", operator: "gt", value: "0" }, empty)).toBe(false)
    expect(evaluateRule({ field: "lead.priority", operator: "eq", value: "high" }, empty)).toBe(
      false
    )
  })

  it("combines rules with AND / OR and nested groups; an empty group passes", () => {
    const high = { field: "lead.priority", operator: "eq", value: "high" } as const
    const low = { field: "lead.priority", operator: "eq", value: "low" } as const
    expect(evaluateConditions({ op: "and", rules: [] }, snapshot)).toBe(true)
    expect(evaluateConditions({ op: "and", rules: [high, low] }, snapshot)).toBe(false)
    expect(evaluateConditions({ op: "or", rules: [high, low] }, snapshot)).toBe(true)
    expect(
      evaluateConditions({ op: "and", rules: [high, { op: "or", rules: [low, high] }] }, snapshot)
    ).toBe(true)
  })
})

describe("triggers", () => {
  it("matches stage entry by move or by creation in that stage", () => {
    const a = automation({
      trigger_type: "lead.stage_entered",
      trigger_config: { stage_id: STAGE },
    })
    expect(
      matchesTrigger(a, event({ type: "lead.stage_changed", payload: { to_stage_id: STAGE } }))
    ).toBe(true)
    expect(matchesTrigger(a, event({ type: "lead.created", payload: { stage_id: STAGE } }))).toBe(
      true
    )
    expect(
      matchesTrigger(a, event({ type: "lead.stage_changed", payload: { to_stage_id: "x" } }))
    ).toBe(false)
  })

  it("matches time-based events only for the configured threshold", () => {
    const a = automation({ trigger_type: "lead.inactive", trigger_config: { days: 7 } })
    expect(matchesTrigger(a, event({ type: "lead.inactive", payload: { days: 7 } }))).toBe(true)
    expect(matchesTrigger(a, event({ type: "lead.inactive", payload: { days: 14 } }))).toBe(false)
  })

  it("never matches events of another organization", () => {
    expect(matchesTrigger(automation(), event({ organization_id: "other" }))).toBe(false)
  })

  it("derives refs and deterministic dedupe keys", () => {
    expect(
      entityRefs(event({ entity_type: "task", entity_id: "t1", payload: { lead_id: "l1" } }))
    ).toEqual({
      leadId: "l1",
      taskId: "t1",
      contactId: null,
    })
    expect(dedupeKey(event({ id: 9 }))).toBe("event:9")
    expect(dedupeKey(event({ dedupe_key: "lead:1:inactive:7:100" }))).toBe("lead:1:inactive:7:100")
  })

  it("protects against loops", () => {
    expect(
      loopReason(automation(), event({ caused_by_automation_id: "auto-1", automation_depth: 1 }))
    ).toBe("self")
    expect(
      loopReason(automation(), event({ caused_by_automation_id: "other", automation_depth: 3 }))
    ).toBe("depth")
    expect(
      loopReason(automation(), event({ caused_by_automation_id: "other", automation_depth: 1 }))
    ).toBeNull()
  })
})

/** Depozit în memorie, cu aceeași regulă de unicitate ca automation_runs (automation_id, dedupe_key). */
function memoryStore(events: DomainEvent[], automations: Automation[], snap: Snapshot = snapshot) {
  const runs = new Map<string, { id: number; status: string; reason?: string }>()
  const executed: { automationId: string; depth: number }[] = []
  const completed: { id: number; error: string | null }[] = []
  let queue = [...events]
  let nextRun = 1
  const byId = new Map<number, string>()

  const store: EngineStore = {
    async claimEvents(limit) {
      const batch = queue.slice(0, limit)
      queue = queue.slice(limit)
      return batch
    },
    async activeAutomations(orgs) {
      return automations.filter((a) => orgs.includes(a.organization_id))
    },
    async snapshot() {
      return snap
    },
    async startRun(a, _event, key) {
      const k = `${a.id}|${key}`
      if (runs.has(k)) return null
      const id = nextRun++
      runs.set(k, { id, status: "running" })
      byId.set(id, k)
      return id
    },
    async finishRun(id, status, result) {
      runs.set(byId.get(id)!, { id, status, reason: String(result.reason) })
    },
    async execute(id, _actions, _refs, depth) {
      const k = byId.get(id)!
      executed.push({ automationId: k.split("|")[0]!, depth })
      runs.set(k, { id, status: "success" })
      return { status: "success", error: null }
    },
    async completeEvent(id, error) {
      completed.push({ id, error })
    },
  }
  return {
    store,
    runs,
    executed,
    completed,
    requeue: (e: DomainEvent[]) => (queue = [...queue, ...e]),
  }
}

describe("engine", () => {
  it("runs each matching automation once and completes the event", async () => {
    const m = memoryStore(
      [event()],
      [automation(), automation({ id: "auto-2", trigger_type: "lead.won" })]
    )
    const stats = await processBatch(m.store)
    expect(stats).toMatchObject({ events: 1, runs: 1, succeeded: 1 })
    expect(m.executed).toEqual([{ automationId: "auto-1", depth: 1 }])
    expect(m.completed).toEqual([{ id: 1, error: null }])
  })

  it("deduplicates: the same event processed again does not run the automation twice", async () => {
    const m = memoryStore([event({ id: 5 })], [automation()])
    await processBatch(m.store)
    m.requeue([event({ id: 5 })])
    const second = await processBatch(m.store)
    expect(second).toMatchObject({ runs: 0, duplicates: 1, succeeded: 0 })
    expect(m.executed).toHaveLength(1)
  })

  it("deduplicates periodic events with the same deterministic key", async () => {
    const a = automation({ trigger_type: "lead.inactive", trigger_config: { days: 7 } })
    const periodic = (id: number) =>
      event({
        id,
        type: "lead.inactive",
        payload: { days: 7 },
        dedupe_key: "lead:lead-1:inactive:7:1700000000",
      })
    const m = memoryStore([periodic(1), periodic(2)], [a])
    const stats = await processBatch(m.store)
    expect(stats).toMatchObject({ runs: 1, duplicates: 1 })
  })

  it("skips its own effects and records the reason", async () => {
    const m = memoryStore(
      [event({ caused_by_automation_id: "auto-1", automation_depth: 1 })],
      [automation()]
    )
    const stats = await processBatch(m.store)
    expect(stats).toMatchObject({ runs: 1, skipped: 1, succeeded: 0 })
    expect([...m.runs.values()][0]).toMatchObject({ status: "skipped", reason: "loop_self" })
  })

  it("skips when conditions or the pipeline filter do not match", async () => {
    const m = memoryStore(
      [event()],
      [
        automation({
          conditions: {
            op: "and",
            rules: [{ field: "lead.value", operator: "gt", value: "50000" }],
          },
        }),
        automation({ id: "auto-2", pipeline_id: "other-pipeline" }),
      ]
    )
    const stats = await processBatch(m.store)
    expect(stats).toMatchObject({ runs: 2, skipped: 2, succeeded: 0 })
  })

  it("retries the event when infrastructure fails", async () => {
    const m = memoryStore([event()], [automation()])
    m.store.snapshot = async () => {
      throw new Error("db down")
    }
    const stats = await processBatch(m.store)
    expect(stats.errors).toBe(1)
    expect(m.completed).toEqual([{ id: 1, error: "db down" }])
  })
})

describe("editor mapping", () => {
  it("stores only the fields of the action type, with numbers", () => {
    expect(
      actionToJson({
        ...emptyAction("create_task"),
        title: "Sună",
        due_in_hours: "48",
        user_id: "x",
      })
    ).toEqual({
      type: "create_task",
      title: "Sună",
      task_type_id: null,
      due_in_hours: 48,
      assignee: "lead_responsible",
      user_id: null,
      priority: "normal",
    })
    expect(actionToJson(emptyAction("record_revenue"))).toEqual({ type: "record_revenue" })
  })

  it("validates the trigger configuration and action fields", () => {
    const base = toFormValues(null)
    expect(automationSchema.safeParse({ ...base, name: "A" }).success).toBe(false) // titlul sarcinii lipsește
    const ok = { ...base, name: "A", actions: [{ ...emptyAction("create_task"), title: "Sună" }] }
    expect(automationSchema.safeParse(ok).success).toBe(true)
    expect(
      automationSchema.safeParse({ ...ok, triggerType: "lead.stage_entered", stageId: null })
        .success
    ).toBe(false)
    expect(
      automationSchema.safeParse({ ...ok, triggerType: "lead.inactive", days: "0" }).success
    ).toBe(false)
  })
})
