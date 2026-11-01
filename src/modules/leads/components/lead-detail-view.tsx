"use client"

import { useRouteDialog } from "@/hooks/use-route-dialog"
import { RecordWorkspace } from "@/modules/activity/components/record-workspace"
import type { WorkspaceData } from "@/modules/activity/workspace"
import type { CrmOptions } from "@/modules/crm-config/types"

import type { LeadDetail, LeadRecord } from "../queries"

import { LeadFormDialog } from "./lead-form-dialog"
import { LeadHeader } from "./lead-header"
import { LeadInfo } from "./lead-info"

/** Fișa lead-ului: antet, informații (A–C) și spațiul de lucru (D–I). Editarea: `?open=edit`. */
export function LeadDetailView({
  lead,
  record,
  options,
  workspace,
  can,
}: {
  lead: LeadDetail
  record: LeadRecord
  options: CrmOptions
  workspace: WorkspaceData
  can: { edit: boolean; assign: boolean; delete: boolean }
}) {
  const routeDialog = useRouteDialog()

  return (
    <>
      <LeadHeader lead={lead} options={options} can={can} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <LeadInfo lead={lead} options={options} />
        <RecordWorkspace data={workspace} />
      </div>
      {routeDialog.openParam === "edit" && can.edit && (
        <LeadFormDialog
          record={record}
          options={options}
          canAssign={can.assign}
          userId={workspace.currentUserId}
          onClose={routeDialog.close}
        />
      )}
    </>
  )
}
