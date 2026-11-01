"use client"

import { MessagesSquare } from "lucide-react"
import { useTranslations } from "next-intl"

import { EmptyState } from "@/components/shared/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { nameById } from "@/modules/crm-config/options"
import { FilesPanel } from "@/modules/files/components/files-panel"
import { NotesPanel } from "@/modules/notes/components/notes-panel"
import { TasksPanel } from "@/modules/tasks/components/tasks-panel"

import type { WorkspaceData } from "../workspace"

import { Timeline } from "./timeline"

/** Tipurile care formează „Istoricul modificărilor” (secțiunea I a fișei). */
const HISTORY_TYPES = new Set([
  "lead.created",
  "lead.updated",
  "lead.stage_changed",
  "lead.responsible_changed",
  "lead.contact_linked",
  "contact.created",
  "company.created",
  "contact.merged",
])

/** Partea dreaptă a fișei: cronologie, sarcini, note, fișiere, conversații, istoric. */
export function RecordWorkspace({
  data,
  conversations = true,
}: {
  data: WorkspaceData
  conversations?: boolean
}) {
  const t = useTranslations("workspace")
  const memberName = nameById(data.members)
  const openTasks = data.tasks.filter(
    (x) => x.status === "new" || x.status === "in_progress"
  ).length

  return (
    <Card>
      <CardContent>
        <Tabs defaultValue="timeline">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="timeline">{t("timeline")}</TabsTrigger>
            <TabsTrigger value="tasks">{t("tasks", { count: openTasks })}</TabsTrigger>
            <TabsTrigger value="notes">{t("notes", { count: data.notes.length })}</TabsTrigger>
            <TabsTrigger value="files">{t("files", { count: data.files.length })}</TabsTrigger>
            {conversations && <TabsTrigger value="conversations">{t("conversations")}</TabsTrigger>}
            <TabsTrigger value="history">{t("history")}</TabsTrigger>
          </TabsList>
          <TabsContent value="timeline">
            <Timeline items={data.activities} memberName={memberName} />
          </TabsContent>
          <TabsContent value="tasks">
            <TasksPanel recordRef={data.recordRef} tasks={data.tasks} context={data.taskContext} />
          </TabsContent>
          <TabsContent value="notes">
            <NotesPanel
              recordRef={data.recordRef}
              notes={data.notes}
              currentUserId={data.currentUserId}
              isAdmin={data.isAdmin}
              memberName={memberName}
            />
          </TabsContent>
          <TabsContent value="files">
            <FilesPanel
              recordRef={data.recordRef}
              files={data.files}
              currentUserId={data.currentUserId}
              isAdmin={data.isAdmin}
              memberName={memberName}
            />
          </TabsContent>
          {conversations && (
            <TabsContent value="conversations">
              <EmptyState
                icon={MessagesSquare}
                title={t("conversationsEmpty")}
                description={t("conversationsHint")}
              />
            </TabsContent>
          )}
          <TabsContent value="history">
            <Timeline
              items={data.activities.filter((a) => HISTORY_TYPES.has(a.type))}
              memberName={memberName}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
