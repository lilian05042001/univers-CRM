"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Copy, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { FormError } from "@/components/shared/form/form-error"
import { SelectField, type SelectOption } from "@/components/shared/form/select-field"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { applyActionResult } from "@/lib/actions/apply-result"

import { inviteMember } from "../actions"
import { inviteMemberSchema, type InviteMemberInput } from "../schemas"

type InviteDialogProps = {
  roles: SelectOption[]
  teams: SelectOption[]
  defaultRoleId?: string
}

export function InviteDialog({ roles, teams, defaultRoleId }: InviteDialogProps) {
  const t = useTranslations("team.invite")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", roleId: defaultRoleId ?? "", teamId: null },
  })

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      form.reset()
      setError(null)
      setInviteUrl(null)
      setCopied(false)
    }
  }

  async function onSubmit(values: InviteMemberInput) {
    setError(null)
    const result = await inviteMember(values)
    if (!result.ok) {
      setError(applyActionResult(form, result))
      return
    }
    setInviteUrl(result.data.inviteUrl)
    router.refresh()
  }

  async function copy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus />
          {t("open")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {inviteUrl ? t("createdDescription") : t("description")}
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <>
            <div className="flex gap-2">
              <Input
                readOnly
                value={inviteUrl}
                aria-label={t("link")}
                onFocus={(e) => e.target.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copy}
                aria-label={t("copy")}
              >
                {copied ? <Check className="text-success" /> : <Copy />}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{t("linkOnce")}</p>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>{t("done")}</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              <FormError error={error} />
              <TextField
                control={form.control}
                name="email"
                label={t("email")}
                type="email"
                autoFocus
              />
              <SelectField control={form.control} name="roleId" label={t("role")} options={roles} />
              <SelectField
                control={form.control}
                name="teamId"
                label={t("team")}
                options={teams}
                noneLabel={t("noTeam")}
              />
              <DialogFooter>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Spinner />}
                  {t("submit")}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
