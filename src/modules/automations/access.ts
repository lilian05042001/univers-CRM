import "server-only"

import type { OrgContext } from "@/lib/auth/session"
import { getCrmOptions } from "@/modules/crm-config/queries"
import { listTaskTypes } from "@/modules/tasks/queries"

import type { EditorOptions } from "./fields"

/** Aceeași regulă ca RLS (private.can_read_automations): configurare sau vizibilitate pe echipă. */
export const canReadAutomations = (ctx: OrgContext) =>
  ctx.can("automations.manage") || ctx.can("crm.view.all") || ctx.can("crm.view.team")

export async function getEditorOptions(organizationId: string): Promise<EditorOptions> {
  const [options, taskTypes] = await Promise.all([
    getCrmOptions(organizationId),
    listTaskTypes(organizationId),
  ])
  return {
    pipelines: options.pipelines,
    sources: options.sources,
    tags: options.tags,
    members: options.members,
    teams: options.teams,
    taskTypes: taskTypes.map((x) => ({ id: x.id, name: x.name })),
  }
}
