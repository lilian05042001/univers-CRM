"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { useActionRunner } from "@/lib/actions/use-action-runner"

import { saveNotificationPreferences } from "../actions"
import { NOTIFICATION_TYPES, type NotificationType } from "../types"

/** Preferințele personale: ce notificări in-app primește utilizatorul curent. */
export function NotificationSettings({ disabled: initial }: { disabled: NotificationType[] }) {
  const t = useTranslations("settings.notificationPrefs")
  const tTypes = useTranslations("notifications.types")
  const { run, pending } = useActionRunner()
  const [disabled, setDisabled] = useState(new Set(initial))
  const dirty = disabled.size !== initial.length || initial.some((x) => !disabled.has(x))

  function toggle(type: NotificationType, enabled: boolean) {
    const next = new Set(disabled)
    if (enabled) next.delete(type)
    else next.add(type)
    setDisabled(next)
  }

  return (
    <div className="flex max-w-xl flex-col gap-5 rounded-xl border bg-card p-6">
      {NOTIFICATION_TYPES.map((type) => (
        <Field key={type} orientation="horizontal" className="items-start">
          <Checkbox
            id={`pref-${type}`}
            checked={!disabled.has(type)}
            onCheckedChange={(v) => toggle(type, v === true)}
          />
          <div>
            <FieldLabel htmlFor={`pref-${type}`}>{tTypes(type)}</FieldLabel>
            <FieldDescription>{t(`hints.${type}`)}</FieldDescription>
          </div>
        </Field>
      ))}
      <Button
        className="w-fit"
        disabled={pending || !dirty}
        onClick={() =>
          run(
            () => saveNotificationPreferences({ disabled: [...disabled] }),
            "settings.notificationPrefs.saved"
          )
        }
      >
        {t("save")}
      </Button>
    </div>
  )
}
