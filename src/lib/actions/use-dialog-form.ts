"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm, type DefaultValues, type FieldValues } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { applyActionResult } from "./apply-result"
import type { ActionResult } from "./result"

/**
 * Formular într-un dialog: reset la deschidere, erori de la Server Action,
 * toast de succes, închidere și reîmprospătarea datelor.
 */
export function useDialogForm<T extends FieldValues>({
  schema,
  defaults,
  action,
  successKey,
}: {
  schema: z.ZodType<T, T>
  defaults: DefaultValues<T>
  action: (values: T) => Promise<ActionResult<unknown>>
  successKey: string
}) {
  const t = useTranslations()
  const router = useRouter()
  const [open, setOpenState] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const form = useForm<T>({ resolver: zodResolver(schema), defaultValues: defaults })

  function setOpen(next: boolean) {
    setOpenState(next)
    if (next) form.reset(defaults)
    setError(null)
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    const result = await action(values)
    if (!result.ok) {
      setError(applyActionResult(form, result))
      return
    }
    toast.success(t(successKey))
    setOpenState(false)
    router.refresh()
  })

  return { form, open, setOpen, error, onSubmit, submitting: form.formState.isSubmitting }
}
