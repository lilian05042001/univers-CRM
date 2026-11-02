import type { Automation, DomainEvent, EntityRefs, Snapshot } from "./types"

/** Lanțurile automatizare → eveniment → automatizare se opresc după această adâncime. */
export const MAX_DEPTH = 3

const str = (v: unknown) => (typeof v === "string" ? v : null)

/** Evenimentul declanșează automatizarea? (doar tipul și configurarea declanșatorului) */
export function matchesTrigger(automation: Automation, event: DomainEvent): boolean {
  if (automation.organization_id !== event.organization_id) return false
  const config = automation.trigger_config ?? {}

  switch (automation.trigger_type) {
    case "lead.created":
    case "lead.won":
    case "lead.lost":
    case "message.received":
      return event.type === automation.trigger_type
    case "lead.stage_entered":
      // Intrarea în etapă: mutare în etapă sau creare direct în ea.
      return (
        Boolean(config.stage_id) &&
        ((event.type === "lead.stage_changed" && event.payload.to_stage_id === config.stage_id) ||
          (event.type === "lead.created" && event.payload.stage_id === config.stage_id))
      )
    case "task.due_soon":
      return (
        event.type === "task.due_soon" &&
        Number(event.payload.minutes) === Number(config.minutes ?? 60)
      )
    case "lead.inactive":
      return (
        event.type === "lead.inactive" && Number(event.payload.days) === Number(config.days ?? 7)
      )
  }
}

/**
 * Protecția la bucle: o automatizare nu reacționează la propriile efecte,
 * iar lanțurile între automatizări se opresc la MAX_DEPTH.
 */
export function loopReason(automation: Automation, event: DomainEvent): "self" | "depth" | null {
  if (event.caused_by_automation_id === automation.id) return "self"
  if (event.automation_depth >= MAX_DEPTH) return "depth"
  return null
}

/**
 * Cheia de deduplicare: aceeași automatizare rulează o singură dată pentru același eveniment.
 * Evenimentele periodice au cheie deterministă (ex. „lead:{id}:inactive:7:{data}”).
 */
export function dedupeKey(event: DomainEvent): string {
  return event.dedupe_key ?? `event:${event.id}`
}

export function entityRefs(event: DomainEvent): EntityRefs {
  if (event.entity_type === "lead")
    return { leadId: event.entity_id, taskId: null, contactId: null }
  if (event.entity_type === "task") {
    return {
      leadId: str(event.payload.lead_id),
      taskId: event.entity_id,
      contactId: str(event.payload.contact_id),
    }
  }
  return {
    leadId: str(event.payload.lead_id),
    taskId: null,
    contactId: str(event.payload.contact_id),
  }
}

/** Filtrul pe pipeline al automatizării (dacă e setat, lead-ul trebuie să fie în el). */
export function matchesPipeline(automation: Automation, snapshot: Snapshot): boolean {
  if (!automation.pipeline_id) return true
  return snapshot.lead?.pipeline_id === automation.pipeline_id
}
