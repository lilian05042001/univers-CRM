"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, type ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormError } from "@/components/shared/form/form-error"
import { SelectField, type SelectOption } from "@/components/shared/form/select-field"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { applyActionResult } from "@/lib/actions/apply-result"

import { createTeam, updateTeam } from "../actions"
import { createTeamSchema, type TeamInput } from "../schemas"

type TeamDialogProps = {
  trigger: ReactNode
  members: SelectOption[]
  team?: { id: string; name: string; manager_id: string | null; memberIds: string[] }
}

export function TeamDialog({ trigger, members, team }: TeamDialogProps) {
  const t = useTranslations("team.teams")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const defaultValues: TeamInput = {
    name: team?.name ?? "",
    managerId: team?.manager_id ?? null,
    memberIds: team?.memberIds ?? [],
  }
  const form = useForm<TeamInput>({ resolver: zodResolver(createTeamSchema), defaultValues })

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) form.reset(defaultValues)
    setError(null)
  }

  async function onSubmit(values: TeamInput) {
    setError(null)
    const result = team ? await updateTeam({ id: team.id, ...values }) : await createTeam(values)
    if (!result.ok) {
      setError(applyActionResult(form, result))
      return
    }
    toast.success(t(team ? "updated" : "created"))
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(team ? "editTitle" : "createTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <FormError error={error} />
            <TextField control={form.control} name="name" label={t("name")} autoFocus />
            <SelectField
              control={form.control}
              name="managerId"
              label={t("manager")}
              options={members}
              noneLabel={t("noManager")}
            />
            <Controller
              control={form.control}
              name="memberIds"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend variant="label">{t("members")}</FieldLegend>
                  <div className="grid max-h-56 gap-3 overflow-y-auto rounded-md border p-3">
                    {members.map((m) => {
                      const checked = field.value.includes(m.value)
                      return (
                        <Field key={m.value} orientation="horizontal">
                          <Checkbox
                            id={`member-${m.value}`}
                            checked={checked}
                            onCheckedChange={(v) =>
                              field.onChange(
                                v
                                  ? [...field.value, m.value]
                                  : field.value.filter((id) => id !== m.value)
                              )
                            }
                          />
                          <FieldLabel htmlFor={`member-${m.value}`} className="font-normal">
                            {m.label}
                          </FieldLabel>
                        </Field>
                      )
                    })}
                  </div>
                </FieldSet>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Spinner />}
                {t("save")}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
