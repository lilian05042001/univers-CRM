"use client"

import { useTranslations } from "next-intl"
import type { FormEventHandler, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"

import { FormError } from "./form-error"

/** Dialog cu formular: titlu, eroare globală, conținut, butoanele Anulează / Salvează. */
export function FormDialog({
  trigger,
  title,
  open,
  onOpenChange,
  onSubmit,
  error,
  submitting,
  children,
}: {
  trigger: ReactNode
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: FormEventHandler<HTMLFormElement>
  error: string | null
  submitting: boolean
  children: ReactNode
}) {
  const t = useTranslations("common")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <FormError error={error} />
            {children}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Spinner />}
                {t("save")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
