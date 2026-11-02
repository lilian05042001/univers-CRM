"use client"

import { Plus } from "lucide-react"
import { useTranslations } from "next-intl"
import { Controller } from "react-hook-form"

import { FormDialog } from "@/components/shared/form/form-dialog"
import { SelectField } from "@/components/shared/form/select-field"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { useDialogForm } from "@/lib/actions/use-dialog-form"
import { API_SCOPES } from "@/lib/api/scopes"

import { createApiKey } from "../actions"
import { API_KEY_EXPIRY, apiKeySchema, type ApiKeyInput } from "../schemas"

/** Cheie nouă: denumire, drepturi (scope-uri), expirare. Cheia se primește o singură dată. */
export function ApiKeyDialog({ onCreated }: { onCreated: (secret: string) => void }) {
  const t = useTranslations("integrations.api")
  const tv = useTranslations()
  const d = useDialogForm<ApiKeyInput>({
    schema: apiKeySchema,
    defaults: { name: "", scopes: ["contacts:read", "leads:read"], expiresIn: "never" },
    action: async (values) => {
      const result = await createApiKey(values)
      if (result.ok) onCreated(result.data.secret)
      return result
    },
    successKey: "integrations.api.created",
  })

  return (
    <FormDialog
      trigger={
        <Button>
          <Plus />
          {t("create")}
        </Button>
      }
      title={t("create")}
      open={d.open}
      onOpenChange={d.setOpen}
      onSubmit={d.onSubmit}
      error={d.error}
      submitting={d.submitting}
    >
      <TextField
        control={d.form.control}
        name="name"
        label={t("name")}
        placeholder={t("namePlaceholder")}
        autoFocus
      />
      <Controller
        control={d.form.control}
        name="scopes"
        render={({ field, fieldState }) => (
          <FieldSet data-invalid={fieldState.invalid || undefined}>
            <FieldLegend variant="label">{t("scopes")}</FieldLegend>
            {API_SCOPES.map((scope) => (
              <Field key={scope} orientation="horizontal">
                <Checkbox
                  id={`scope-${scope}`}
                  checked={field.value.includes(scope)}
                  onCheckedChange={(checked) =>
                    field.onChange(
                      checked ? [...field.value, scope] : field.value.filter((s) => s !== scope)
                    )
                  }
                />
                <FieldLabel htmlFor={`scope-${scope}`} className="font-normal">
                  {t(`scopeLabels.${scope.replace(":", "_")}`)}
                </FieldLabel>
              </Field>
            ))}
            {fieldState.error?.message && <FieldError>{tv(fieldState.error.message)}</FieldError>}
          </FieldSet>
        )}
      />
      <SelectField
        control={d.form.control}
        name="expiresIn"
        label={t("expiresIn")}
        options={API_KEY_EXPIRY.map((value) => ({ value, label: t(`expiry.${value}`) }))}
      />
    </FormDialog>
  )
}
