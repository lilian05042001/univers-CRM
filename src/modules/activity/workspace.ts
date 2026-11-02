import "server-only"

import type { OrgContext } from "@/lib/auth/session"
import type { RecordRef } from "@/lib/crm/record-ref"
import { getCrmOptions } from "@/modules/crm-config/queries"
import { listConversationsFor } from "@/modules/inbox/queries"
import { listTaskTypes, listTasksFor } from "@/modules/tasks/queries"

import { listActivities, listFiles, listNotes } from "./queries"

/** Toate datele panourilor dintr-o fișă (cronologie, sarcini, note, fișiere, conversații), în paralel. */
export async function loadWorkspace(ref: RecordRef, ctx: OrgContext) {
  const [activities, notes, files, tasks, types, options, conversations] = await Promise.all([
    listActivities(ref),
    listNotes(ref),
    listFiles(ref),
    listTasksFor(ref),
    listTaskTypes(ctx.organizationId),
    getCrmOptions(ctx.organizationId),
    listConversationsFor(ref),
  ])

  return {
    recordRef: ref,
    activities,
    notes,
    files,
    tasks,
    conversations,
    currentUserId: ctx.user.id,
    isAdmin: ctx.membership.role.key === "admin",
    taskContext: {
      types,
      members: options.members,
      currentUserId: ctx.user.id,
      timeZone: ctx.membership.organization.timezone,
    },
    members: options.members,
  }
}

export type WorkspaceData = Awaited<ReturnType<typeof loadWorkspace>>
