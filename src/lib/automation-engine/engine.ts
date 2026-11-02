import { evaluateConditions } from "./conditions"
import { dedupeKey, entityRefs, loopReason, matchesPipeline, matchesTrigger } from "./triggers"
import type { Automation, AutomationAction, DomainEvent, EntityRefs, Snapshot } from "./types"

/** Accesul la date al motorului (în producție: RPC-uri service_role; în teste: memorie). */
export interface EngineStore {
  claimEvents(limit: number): Promise<DomainEvent[]>
  activeAutomations(organizationIds: string[]): Promise<Automation[]>
  snapshot(refs: EntityRefs): Promise<Snapshot>
  /** null = există deja o execuție cu aceeași cheie (deduplicare). */
  startRun(automation: Automation, event: DomainEvent, key: string): Promise<number | null>
  finishRun(runId: number, status: "skipped", result: Record<string, unknown>): Promise<void>
  execute(
    runId: number,
    actions: AutomationAction[],
    refs: EntityRefs,
    depth: number
  ): Promise<{ status: "success" | "failed"; error: string | null }>
  completeEvent(eventId: number, error: string | null): Promise<void>
}

export type BatchStats = {
  events: number
  runs: number
  succeeded: number
  failed: number
  skipped: number
  duplicates: number
  errors: number
}

/** Procesează un lot de evenimente din outbox. Returnează statistici pentru jurnal. */
export async function processBatch(store: EngineStore, limit = 50): Promise<BatchStats> {
  const stats: BatchStats = {
    events: 0,
    runs: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    duplicates: 0,
    errors: 0,
  }
  const events = await store.claimEvents(limit)
  stats.events = events.length
  if (events.length === 0) return stats

  const automations = await store.activeAutomations([
    ...new Set(events.map((e) => e.organization_id)),
  ])

  for (const event of events) {
    try {
      await processEvent(store, event, automations, stats)
      await store.completeEvent(event.id, null)
    } catch (error) {
      // Eroare de infrastructură: evenimentul se reia mai târziu (backoff în complete_domain_event).
      stats.errors++
      await store.completeEvent(event.id, error instanceof Error ? error.message : String(error))
    }
  }
  return stats
}

async function processEvent(
  store: EngineStore,
  event: DomainEvent,
  automations: Automation[],
  stats: BatchStats
) {
  const matching = automations.filter((a) => matchesTrigger(a, event))
  if (matching.length === 0) return

  const refs = entityRefs(event)
  let snapshot: Snapshot | null = null

  for (const automation of matching) {
    const runId = await store.startRun(automation, event, dedupeKey(event))
    if (runId === null) {
      stats.duplicates++
      continue
    }
    stats.runs++

    const loop = loopReason(automation, event)
    if (loop) {
      stats.skipped++
      await store.finishRun(runId, "skipped", { reason: `loop_${loop}` })
      continue
    }

    snapshot ??= await store.snapshot(refs)
    if (!matchesPipeline(automation, snapshot)) {
      stats.skipped++
      await store.finishRun(runId, "skipped", { reason: "pipeline" })
      continue
    }
    if (!evaluateConditions(automation.conditions, snapshot)) {
      stats.skipped++
      await store.finishRun(runId, "skipped", { reason: "conditions" })
      continue
    }

    const result = await store.execute(runId, automation.actions, refs, event.automation_depth + 1)
    if (result.status === "success") stats.succeeded++
    else stats.failed++
    // Efectele acțiunilor pot schimba lead-ul: următoarea automatizare citește din nou.
    snapshot = null
  }
}
