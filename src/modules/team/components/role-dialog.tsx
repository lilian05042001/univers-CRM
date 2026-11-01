"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState, type ReactNode } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormError } from "@/components/shared/form/form-error"
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
import {
  PERMISSION_GROUPS,
  type Permission,
  type PermissionGroup,
} from "@/modules/auth/permissions"

import { createRole, updateRole } from "../actions"
import { createRoleSchema, type RoleInput } from "../schemas"

/** Cheile i18n nu pot conține puncte (sunt căi): „crm.view.all” → „crm_view_all”. */
export const permissionMessageKey = (p: Permission) => p.replaceAll(".", "_")

type RoleDialogProps = {
  trigger: ReactNode
  role?: { id: string; name: string; description: string | null; permissions: string[] }
}

export function RoleDialog({ trigger, role }: RoleDialogProps) {
  const t = useTranslations("settings.roles")
  const tPerm = useTranslations("permissions")
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const defaultValues: RoleInput = {
    name: role?.name ?? "",
    description: role?.description ?? "",
    permissions: (role?.permissions ?? []) as Permission[],
  }
  const form = useForm<RoleInput>({ resolver: zodResolver(createRoleSchema), defaultValues })

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) form.reset(defaultValues)
    setError(null)
  }

  async function onSubmit(values: RoleInput) {
    setError(null)
    const result = role ? await updateRole({ id: role.id, ...values }) : await createRole(values)
    if (!result.ok) {
      setError(applyActionResult(form, result))
      return
    }
    toast.success(t(role ? "updated" : "created"))
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t(role ? "editTitle" : "createTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <FormError error={error} />
            <div className="grid gap-6 sm:grid-cols-2">
              <TextField control={form.control} name="name" label={t("name")} />
              <TextField control={form.control} name="description" label={t("description")} />
            </div>
            <Controller
              control={form.control}
              name="permissions"
              render={({ field }) => (
                <div className="grid gap-5 sm:grid-cols-2">
                  {(Object.keys(PERMISSION_GROUPS) as PermissionGroup[]).map((group) => (
                    <FieldSet key={group}>
                      <FieldLegend variant="label">{tPerm(`groups.${group}`)}</FieldLegend>
                      <div className="grid gap-2.5">
                        {PERMISSION_GROUPS[group].map((perm) => {
                          const id = `perm-${perm}`
                          return (
                            <Field key={perm} orientation="horizontal">
                              <Checkbox
                                id={id}
                                checked={field.value.includes(perm)}
                                onCheckedChange={(v) =>
                                  field.onChange(
                                    v
                                      ? [...field.value, perm]
                                      : field.value.filter((p) => p !== perm)
                                  )
                                }
                              />
                              <FieldLabel htmlFor={id} className="font-normal">
                                {tPerm(permissionMessageKey(perm))}
                              </FieldLabel>
                            </Field>
                          )
                        })}
                      </div>
                    </FieldSet>
                  ))}
                </div>
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
