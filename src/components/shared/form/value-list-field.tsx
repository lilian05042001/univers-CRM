"use client"

import { Plus, X } from "lucide-react"
import { useTranslations } from "next-intl"
import {
  Controller,
  useFieldArray,
  type ArrayPath,
  type Control,
  type FieldArray,
  type FieldValues,
  type Path,
} from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

/** Listă editabilă de valori `{ value }` (telefoane, e-mailuri); primul element e cel principal. */
export function ValueListField<T extends FieldValues>({
  control,
  name,
  label,
  addLabel,
  type = "text",
}: {
  control: Control<T>
  name: ArrayPath<T>
  label: string
  addLabel: string
  type?: "text" | "tel" | "email"
}) {
  const t = useTranslations()
  const { fields, append, remove } = useFieldArray({ control, name })

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-col gap-2">
        {fields.map((item, index) => (
          <Controller
            key={item.id}
            control={control}
            name={`${name}.${index}.value` as Path<T>}
            render={({ field, fieldState }) => (
              <div>
                <div className="flex gap-1">
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    type={type}
                    aria-label={`${label} ${index + 1}`}
                    aria-invalid={fieldState.invalid}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    aria-label={t("common.remove")}
                  >
                    <X />
                  </Button>
                </div>
                {fieldState.error?.message && (
                  <FieldError>{t(fieldState.error.message)}</FieldError>
                )}
              </div>
            )}
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => append({ value: "" } as FieldArray<T, ArrayPath<T>>)}
        >
          <Plus />
          {addLabel}
        </Button>
      </div>
    </Field>
  )
}
