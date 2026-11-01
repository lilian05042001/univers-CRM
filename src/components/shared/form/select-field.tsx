"use client"

import { useTranslations } from "next-intl"
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form"

import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type SelectOption = { value: string; label: string }

/** Valoarea specială pentru „fără selecție” (Radix Select nu acceptă value=""). */
export const NONE_VALUE = "__none__"

type SelectFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: FieldPath<T>
  label: string
  options: SelectOption[]
  placeholder?: string
  /** Dacă e setat, apare o opțiune care golește câmpul (null). */
  noneLabel?: string
  disabled?: boolean
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
  noneLabel,
  disabled,
}: SelectFieldProps<T>) {
  const t = useTranslations()

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <Select
            value={field.value ?? (noneLabel ? NONE_VALUE : "")}
            onValueChange={(v) => field.onChange(v === NONE_VALUE ? null : v)}
            disabled={disabled}
          >
            <SelectTrigger
              id={field.name}
              className="w-full"
              aria-invalid={fieldState.invalid}
              onBlur={field.onBlur}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {noneLabel && <SelectItem value={NONE_VALUE}>{noneLabel}</SelectItem>}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldState.error?.message && <FieldError>{t(fieldState.error.message)}</FieldError>}
        </Field>
      )}
    />
  )
}
