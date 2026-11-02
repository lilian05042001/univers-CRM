"use client"

import { KeyRound, Pencil } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CopyField } from "@/components/shared/copy-field"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import { useDialogForm } from "@/lib/actions/use-dialog-form"
import { CHANNEL_HEADER } from "@/lib/channels/constants"

import type { ChannelItem } from "../queries"
import { channelSchema, type ChannelInput } from "../schemas"
import { renameChannel, rotateWebhookSecret } from "../settings-actions"

import { ChannelIcon } from "./channel-icon"

function RenameDialog({ channel }: { channel: ChannelItem }) {
  const t = useTranslations("settings.channels")
  const d = useDialogForm<ChannelInput>({
    schema: channelSchema,
    defaults: { id: channel.id, name: channel.name },
    action: renameChannel,
    successKey: "settings.channels.saved",
  })
  return (
    <FormDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={t("rename")}>
          <Pencil />
        </Button>
      }
      title={t("rename")}
      open={d.open}
      onOpenChange={d.setOpen}
      onSubmit={d.onSubmit}
      error={d.error}
      submitting={d.submitting}
    >
      <TextField control={d.form.control} name="name" label={t("name")} autoFocus />
    </FormDialog>
  )
}

/** Canalele organizației: denumire, stare, adresa webhook și cheia (afișată o singură dată). */
export function ChannelsSettings({
  channels,
  webhookBaseUrl,
  canManage,
}: {
  channels: ChannelItem[]
  webhookBaseUrl: string
  canManage: boolean
}) {
  const t = useTranslations("settings.channels")
  const { run, pending } = useActionRunner()
  const [secret, setSecret] = useState<{ channel: ChannelItem; value: string } | null>(null)

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      <Card className="py-0">
        <CardContent className="divide-y px-0">
          {channels.map((channel) => (
            <div key={channel.id} className="flex flex-col gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <ChannelIcon provider={channel.provider} className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{channel.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`providers.${channel.provider}`)} · {t(`status.${channel.status}`)} ·{" "}
                    {channel.hasWebhookSecret ? t("keySet") : t("keyMissing")}
                  </p>
                </div>
                {canManage && (
                  <>
                    <RenameDialog channel={channel} />
                    <ConfirmDialog
                      trigger={
                        <Button variant="outline" size="sm" disabled={pending}>
                          <KeyRound />
                          {t("rotate")}
                        </Button>
                      }
                      title={t("rotateTitle")}
                      description={t("rotateDescription")}
                      confirmLabel={t("rotate")}
                      destructive={channel.hasWebhookSecret}
                      onConfirm={() =>
                        run(
                          () => rotateWebhookSecret({ id: channel.id }),
                          undefined,
                          (data) => setSecret({ channel, value: data.secret })
                        )
                      }
                    />
                  </>
                )}
              </div>
              <CopyField label={t("webhookUrl")} value={`${webhookBaseUrl}/${channel.provider}`} />
              <CopyField
                label={t("channelHeader", { header: CHANNEL_HEADER })}
                value={channel.id}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={secret !== null} onOpenChange={(open) => !open && setSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("secretTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("secretHint")}</p>
          {secret && <CopyField label={t("secret")} value={secret.value} />}
          <p className="text-xs text-muted-foreground">{t("usage", { header: CHANNEL_HEADER })}</p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
