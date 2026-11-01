"use client"

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form"

import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"

export function CheckboxField<T extends FieldValues>({
  control,
  name,
  label,
}: {
  control: Control<T>
  name: FieldPath<T>
  label: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal">
          <Checkbox
            id={field.name}
            checked={field.value === true}
            onCheckedChange={(v) => field.onChange(v === true)}
          />
          <FieldLabel htmlFor={field.name} className="font-normal">
            {label}
          </FieldLabel>
        </Field>
      )}
    />
  )
}
