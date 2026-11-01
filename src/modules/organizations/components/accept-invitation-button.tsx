"use client"

import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"

import { FormError } from "@/components/shared/form/form-error"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

import { acceptInvitation } from "../actions"

export function AcceptInvitationButton({ token }: { token: string }) {
  const t = useTranslations("invite")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-4">
      <FormError error={error} />
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptInvitation({ token })
            if (!result.ok) setError(result.error)
          })
        }
      >
        {pending && <Spinner />}
        {t("accept")}
      </Button>
    </div>
  )
}
