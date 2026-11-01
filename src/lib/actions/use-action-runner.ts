"use client"

import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { toast } from "sonner"

import type { ActionResult } from "./result"

/**
 * Rulează o Server Action fără formular (ex. butoane din tabele):
 * stare pending, toast de succes/eroare și reîmprospătarea datelor.
 */
export function useActionRunner() {
  const t = useTranslations()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function run<T>(
    action: () => Promise<ActionResult<T>>,
    successKey?: string,
    onSuccess?: (data: T) => void
  ) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(t(result.error))
        return
      }
      if (successKey) toast.success(t(successKey))
      onSuccess?.(result.data)
      router.refresh()
    })
  }

  return { run, pending }
}
