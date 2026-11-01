"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { NamedOption } from "@/modules/crm-config/types"

/** Cere motivul pierderii la mutarea unui lead în „Pierdut” (listă, acțiuni în masă, kanban). */
export function LossReasonDialog({
  reasons,
  onConfirm,
  onCancel,
}: {
  reasons: NamedOption[]
  onConfirm: (lossReasonId: string) => void
  onCancel: () => void
}) {
  const t = useTranslations("leads.loss")
  const [reason, setReason] = useState<string>("")

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="loss-reason">{t("reason")}</FieldLabel>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger id="loss-reason" className="w-full">
              <SelectValue placeholder={t("placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {reasons.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button variant="destructive" disabled={!reason} onClick={() => onConfirm(reason)}>
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
