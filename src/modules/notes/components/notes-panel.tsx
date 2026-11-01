"use client"

import { Pin, PinOff, StickyNote, Trash2 } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import type { RecordRef } from "@/lib/crm/record-ref"
import type { NoteItem } from "@/modules/activity/queries"

import { addNote, deleteNote, updateNote } from "../actions"

export function NotesPanel({
  recordRef,
  notes,
  currentUserId,
  isAdmin,
  memberName,
}: {
  recordRef: RecordRef
  notes: NoteItem[]
  currentUserId: string
  isAdmin: boolean
  memberName: (id: string | null | undefined) => string | undefined
}) {
  const t = useTranslations("notes")
  const format = useFormatter()
  const { run, pending } = useActionRunner()
  const [draft, setDraft] = useState("")

  function submit() {
    const body = draft.trim()
    if (!body) return
    run(
      () => addNote({ ref: recordRef, body }),
      "notes.added",
      () => setDraft("")
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit()
          }}
          placeholder={t("placeholder")}
          aria-label={t("placeholder")}
          rows={3}
        />
        <Button className="w-fit" size="sm" disabled={pending || !draft.trim()} onClick={submit}>
          {t("add")}
        </Button>
      </div>

      {notes.length === 0 ? (
        <EmptyState icon={StickyNote} title={t("emptyTitle")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => {
            const canEdit = note.createdBy === currentUserId || isAdmin
            return (
              <li
                key={note.id}
                className={`rounded-lg border p-3 ${note.isPinned ? "border-warning/40 bg-warning/5" : "bg-card"}`}
              >
                <p className="text-sm whitespace-pre-line">{note.body}</p>
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <span>
                    {memberName(note.createdBy) ?? "—"} ·{" "}
                    {format.dateTime(new Date(note.createdAt), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  {canEdit && (
                    <span className="ml-auto flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={pending}
                        aria-label={t(note.isPinned ? "unpin" : "pin")}
                        onClick={() =>
                          run(() => updateNote({ id: note.id, isPinned: !note.isPinned }))
                        }
                      >
                        {note.isPinned ? <PinOff /> : <Pin />}
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("delete")}
                            disabled={pending}
                          >
                            <Trash2 />
                          </Button>
                        }
                        title={t("deleteTitle")}
                        description={t("deleteDescription")}
                        confirmLabel={t("delete")}
                        onConfirm={() => run(() => deleteNote({ id: note.id }), "notes.deleted")}
                      />
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
