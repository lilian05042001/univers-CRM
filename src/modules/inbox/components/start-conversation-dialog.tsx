"use client"

import { MessageSquarePlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { EntityPickerField } from "@/components/shared/form/entity-picker-field"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"
import { useDialogForm } from "@/lib/actions/use-dialog-form"
import { searchContactOptions } from "@/modules/contacts/actions"

import { startConversation } from "../actions"
import { startConversationSchema, type StartConversationInput } from "../schemas"

/** Conversație nouă pe canalul intern cu un contact existent. */
export function StartConversationDialog() {
  const t = useTranslations("inbox.start")
  const router = useRouter()
  const d = useDialogForm<StartConversationInput>({
    schema: startConversationSchema,
    defaults: { contactId: null, subject: "" },
    action: async (values) => {
      const result = await startConversation(values)
      if (result.ok) router.push(`/inbox/${result.data.id}`)
      return result
    },
    successKey: "inbox.start.started",
  })

  return (
    <FormDialog
      trigger={
        <Button size="sm" variant="outline">
          <MessageSquarePlus />
          {t("button")}
        </Button>
      }
      title={t("title")}
      open={d.open}
      onOpenChange={d.setOpen}
      onSubmit={d.onSubmit}
      error={d.error}
      submitting={d.submitting}
    >
      <EntityPickerField
        control={d.form.control}
        name="contactId"
        label={t("contact")}
        search={searchContactOptions}
      />
      <TextField control={d.form.control} name="subject" label={t("subject")} />
    </FormDialog>
  )
}
