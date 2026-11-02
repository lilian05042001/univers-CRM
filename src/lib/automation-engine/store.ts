import "server-only"

import type { Json } from "@/lib/supabase/database.types"
import { createAdminClient } from "@/lib/supabase/admin"

import type { EngineStore } from "./engine"
import type { Automation, DomainEvent, Snapshot } from "./types"

/** Motorul în producție: doar RPC-uri executabile de service_role (fără acces direct la tabele). */
export function createEngineStore(): EngineStore {
  const admin = createAdminClient()

  async function rpc<T>(promise: PromiseLike<{ data: T; error: unknown }>): Promise<T> {
    const { data, error } = await promise
    if (error) throw error instanceof Error ? error : new Error(JSON.stringify(error))
    return data
  }

  return {
    async claimEvents(limit) {
      const rows = await rpc(admin.rpc("claim_domain_events", { p_limit: limit }))
      return (rows ?? []).map((r) => ({
        id: r.id,
        organization_id: r.organization_id,
        type: r.type,
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        payload: (r.payload ?? {}) as Record<string, unknown>,
        caused_by_automation_id: r.caused_by_automation_id,
        automation_depth: r.automation_depth,
        dedupe_key: r.dedupe_key,
      })) satisfies DomainEvent[]
    },

    async activeAutomations(organizationIds) {
      const rows = await rpc(admin.rpc("active_automations", { p_orgs: organizationIds }))
      return rows as unknown as Automation[]
    },

    async snapshot(refs) {
      const data = await rpc(
        admin.rpc("automation_snapshot", {
          p_lead: refs.leadId ?? undefined,
          p_task: refs.taskId ?? undefined,
        })
      )
      return (data ?? { lead: null, task: null }) as Snapshot
    },

    async startRun(automation, event, key) {
      const id = await rpc(
        admin.rpc("automation_start_run", {
          p_automation: automation.id,
          p_event: event.id,
          p_dedupe_key: key,
          p_entity_type: event.entity_type,
          p_entity_id: event.entity_id,
        })
      )
      return id ?? null
    },

    async finishRun(runId, status, result) {
      await rpc(
        admin.rpc("automation_finish_run", {
          p_run: runId,
          p_status: status,
          p_result: result as Json,
        })
      )
    },

    async execute(runId, actions, refs, depth) {
      const result = (await rpc(
        admin.rpc("automation_execute", {
          p_run: runId,
          p_actions: actions as unknown as Json,
          p_lead: refs.leadId ?? undefined,
          p_task: refs.taskId ?? undefined,
          p_contact: refs.contactId ?? undefined,
          p_depth: depth,
        })
      )) as { status: "success" | "failed"; error: string | null }
      return result
    },

    async completeEvent(eventId, error) {
      await rpc(admin.rpc("complete_domain_event", { p_id: eventId, p_error: error ?? undefined }))
    },

    async completeEvents(eventIds) {
      await rpc(admin.rpc("complete_domain_events", { p_ids: eventIds }))
    },
  }
}
