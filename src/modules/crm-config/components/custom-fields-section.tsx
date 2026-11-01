"use client"

import { useTranslations } from "next-intl"
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form"

import { MultiSelectField } from "@/components/shared/form/multi-select-field"
import { SelectField } from "@/components/shared/form/select-field"
import { TextField } from "@/components/shared/form/text-field"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"

import type { CustomFieldDef } from "../types"

/** Câmpurile personalizate ale unei entități, sub cheia `customFields` a formularului. */
export function CustomFieldsSection<T extends FieldValues>({
  control,
  defs,
}: {
  control: Control<T>
  defs: CustomFieldDef[]
}) {
  const t = useTranslations("customFields")
  if (defs.length === 0) return null

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {defs.map((def) => {
        const name = `customFields.${def.key}` as Path<T>
        const label = def.isRequired ? `${def.label} *` : def.label
        switch (def.type) {
          case "select":
            return (
              <SelectField
                key={def.id}
                control={control}
                name={name}
                label={label}
                options={def.options.map((o) => ({ value: o, label: o }))}
                noneLabel={t("none")}
              />
            )
          case "multiselect":
            return (
              <MultiSelectField
                key={def.id}
                control={control}
                name={name}
                label={label}
                options={def.options.map((o) => ({ value: o, label: o }))}
              />
            )
          case "bool":
            return (
              <Controller
                key={def.id}
                control={control}
                name={name}
                render={({ field }) => (
                  <Field orientation="horizontal" className="self-end">
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
          default:
            return (
              <TextField
                key={def.id}
                control={control}
                name={name}
                label={label}
                type={def.type === "date" || def.type === "url" ? def.type : "text"}
                inputMode={def.type === "number" ? "decimal" : undefined}
              />
            )
        }
      })}
    </div>
  )
}
