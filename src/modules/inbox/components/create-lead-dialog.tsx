"use client"

import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"

import { FormDialog } from "@/components/shared/form/form-dialog"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"
import { useDialogForm } from "@/lib/actions/use-dialog-form"

import { createLeadFromConversation } from "../actions"
import { createLeadFromConversationSchema, type CreateLeadFromConversationInput } from "../schemas"

/** Lead nou din conversație (pipeline-ul implicit, contactul conversației, responsabil = eu). */
export function CreateLeadDialog({
  conversationId,
  defaultTitle,
}: {
  conversationId: string
  defaultTitle: string
}) {
  const t = useTranslations("inbox.panel")
  const d = useDialogForm<CreateLeadFromConversationInput>({
    schema: createLeadFromConversationSchema,
    defaults: { conversationId, title: defaultTitle },
    action: createLeadFromConversation,
    successKey: "inbox.panel.leadCreated",
  })

  return (
    <FormDialog
      trigger={
        <Button variant="outline" size="sm">
          <Plus />
          {t("createLead")}
        </Button>
      }
      title={t("createLead")}
      open={d.open}
      onOpenChange={d.setOpen}
      onSubmit={d.onSubmit}
      error={d.error}
      submitting={d.submitting}
    >
      <TextField control={d.form.control} name="title" label={t("leadTitle")} autoFocus />
    </FormDialog>
  )
}
