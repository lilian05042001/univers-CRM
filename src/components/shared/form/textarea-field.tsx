"use client"

import { useTranslations } from "next-intl"
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form"

import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  rows = 4,
}: {
  control: Control<T>
  name: FieldPath<T>
  label: string
  rows?: number
}) {
  const t = useTranslations()

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Textarea
            {...field}
            value={field.value ?? ""}
            id={field.name}
            rows={rows}
            aria-invalid={fieldState.invalid}
          />
          {fieldState.error?.message && <FieldError>{t(fieldState.error.message)}</FieldError>}
        </Field>
      )}
    />
  )
}
