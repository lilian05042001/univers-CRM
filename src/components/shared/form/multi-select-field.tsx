"use client"

import { Check, ChevronsUpDown } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type MultiOption = { value: string; label: string; render?: ReactNode }

/** Selecție multiplă cu căutare (etichete, valori multiselect). Valoarea: string[]. */
export function MultiSelectField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
}: {
  control: Control<T>
  name: FieldPath<T>
  label: string
  options: MultiOption[]
  placeholder?: string
}) {
  const t = useTranslations()

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value: string[] = field.value ?? []
        const selected = options.filter((o) => value.includes(o.value))
        return (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id={field.name}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-9 w-full justify-between font-normal"
                >
                  <span className="flex flex-wrap gap-1">
                    {selected.length === 0 && (
                      <span className="text-muted-foreground">
                        {placeholder ?? t("common.select")}
                      </span>
                    )}
                    {selected.map((o) => (
                      <span key={o.value}>{o.render ?? o.label}</span>
                    ))}
                  </span>
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                <Command>
                  <CommandInput placeholder={t("common.search")} />
                  <CommandList>
                    <CommandEmpty>{t("search.empty")}</CommandEmpty>
                    <CommandGroup>
                      {options.map((o) => {
                        const checked = value.includes(o.value)
                        return (
                          <CommandItem
                            key={o.value}
                            value={o.label}
                            onSelect={() =>
                              field.onChange(
                                checked ? value.filter((v) => v !== o.value) : [...value, o.value]
                              )
                            }
                          >
                            <Check className={checked ? "opacity-100" : "opacity-0"} />
                            {o.render ?? o.label}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {fieldState.error?.message && <FieldError>{t(fieldState.error.message)}</FieldError>}
          </Field>
        )
      }}
    />
  )
}
