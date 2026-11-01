"use client"

import { Pencil, Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CheckboxField } from "@/components/shared/form/checkbox-field"
import { FormDialog } from "@/components/shared/form/form-dialog"
import { SelectField } from "@/components/shared/form/select-field"
import { TextField } from "@/components/shared/form/text-field"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import { useDialogForm } from "@/lib/actions/use-dialog-form"

import { deleteSource, saveSource } from "../actions"
import type { SourceRow } from "../queries"
import { SOURCE_CHANNELS, sourceSchema, type SourceInput } from "../schemas"

function SourceDialog({ source, trigger }: { source?: SourceRow; trigger: ReactNode }) {
  const t = useTranslations("settings.sources")
  const d = useDialogForm<SourceInput>({
    schema: sourceSchema,
    defaults: {
      id: source?.id,
      name: source?.name ?? "",
      channel: (source?.channel as SourceInput["channel"]) ?? "manual",
      isActive: source?.is_active ?? true,
    },
    action: saveSource,
    successKey: "settings.sources.saved",
  })

  return (
    <FormDialog
      trigger={trigger}
      title={t(source ? "editTitle" : "createTitle")}
      open={d.open}
      onOpenChange={d.setOpen}
      onSubmit={d.onSubmit}
      error={d.error}
      submitting={d.submitting}
    >
      <TextField control={d.form.control} name="name" label={t("name")} autoFocus />
      <SelectField
        control={d.form.control}
        name="channel"
        label={t("channel")}
        options={SOURCE_CHANNELS.map((c) => ({ value: c, label: t(`channels.${c}`) }))}
      />
      <CheckboxField control={d.form.control} name="isActive" label={t("active")} />
    </FormDialog>
  )
}

export function SourcesSettings({
  sources,
  canManage,
}: {
  sources: SourceRow[]
  canManage: boolean
}) {
  const t = useTranslations("settings.sources")
  const { run, pending } = useActionRunner()

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <SourceDialog
            trigger={
              <Button>
                <Plus />
                {t("create")}
              </Button>
            }
          />
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("channel")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              {canManage && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{t(`channels.${s.channel}`)}</TableCell>
                <TableCell>
                  <StatusBadge tone={s.is_active ? "success" : "neutral"} dot>
                    {t(s.is_active ? "activeLabel" : "inactiveLabel")}
                  </StatusBadge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <SourceDialog
                        source={s}
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
                        description={t("deleteDescription", { name: s.name })}
                        confirmLabel={t("delete")}
                        onConfirm={() =>
                          run(() => deleteSource({ id: s.id }), "settings.sources.deleted")
                        }
                      />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
