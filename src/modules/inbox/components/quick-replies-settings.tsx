"use client"

import { Pencil, Plus, Trash2, UsersRound } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { CheckboxField } from "@/components/shared/form/checkbox-field"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { TextareaField } from "@/components/shared/form/textarea-field"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import { useDialogForm } from "@/lib/actions/use-dialog-form"

import type { QuickReply } from "../queries"
import { quickReplySchema, type QuickReplyInput } from "../schemas"
import { deleteQuickReply, saveQuickReply } from "../settings-actions"

function QuickReplyDialog({
  reply,
  canManageShared,
  trigger,
}: {
  reply?: QuickReply
  canManageShared: boolean
  trigger: ReactNode
}) {
  const t = useTranslations("settings.quickReplies")
  const d = useDialogForm<QuickReplyInput>({
    schema: quickReplySchema,
    defaults: {
      id: reply?.id,
      title: reply?.title ?? "",
      shortcut: reply?.shortcut ?? "",
      body: reply?.body ?? "",
      shared: reply ? reply.ownerId === null : canManageShared,
    },
    action: saveQuickReply,
    successKey: "settings.quickReplies.saved",
  })

  return (
    <FormDialog
      trigger={trigger}
      title={t(reply ? "editTitle" : "createTitle")}
      open={d.open}
      onOpenChange={d.setOpen}
      onSubmit={d.onSubmit}
      error={d.error}
      submitting={d.submitting}
    >
      <TextField control={d.form.control} name="title" label={t("name")} autoFocus />
      <TextField
        control={d.form.control}
        name="shortcut"
        label={t("shortcut")}
        description={t("shortcutHint")}
      />
      <TextareaField control={d.form.control} name="body" label={t("body")} rows={5} />
      {!reply && canManageShared && (
        <CheckboxField control={d.form.control} name="shared" label={t("shared")} />
      )}
    </FormDialog>
  )
}

export function QuickRepliesSettings({
  replies,
  currentUserId,
  canManageShared,
}: {
  replies: QuickReply[]
  currentUserId: string
  canManageShared: boolean
}) {
  const t = useTranslations("settings.quickReplies")
  const { run, pending } = useActionRunner()
  const canEdit = (r: QuickReply) =>
    r.ownerId === currentUserId || (r.ownerId === null && canManageShared)

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex justify-end">
        <QuickReplyDialog
          canManageShared={canManageShared}
          trigger={
            <Button>
              <Plus />
              {t("create")}
            </Button>
          }
        />
      </div>
      {replies.length === 0 ? (
        <EmptyState icon={Plus} title={t("emptyTitle")} description={t("emptyHint")} />
      ) : (
        <Card className="py-0">
          <CardContent className="divide-y px-0">
            {replies.map((reply) => (
              <div key={reply.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    {reply.title}
                    {reply.shortcut && (
                      <span className="font-mono text-xs text-muted-foreground">
                        /{reply.shortcut}
                      </span>
                    )}
                    {reply.ownerId === null && (
                      <UsersRound
                        className="size-3.5 text-muted-foreground"
                        aria-label={t("sharedBadge")}
                      />
                    )}
                  </p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{reply.body}</p>
                </div>
                {canEdit(reply) && (
                  <>
                    <QuickReplyDialog
                      reply={reply}
                      canManageShared={canManageShared}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={t("edit")}>
                          <Pencil />
                        </Button>
                      }
                    />
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
                      description={t("deleteDescription", { name: reply.title })}
                      confirmLabel={t("delete")}
                      onConfirm={() =>
                        run(
                          () => deleteQuickReply({ id: reply.id }),
                          "settings.quickReplies.deleted"
                        )
                      }
                    />
                  </>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
