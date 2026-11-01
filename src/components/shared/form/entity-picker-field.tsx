"use client"

import { Check, ChevronsUpDown, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
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
import type { ActionResult } from "@/lib/actions/result"

export type PickerOption = { id: string; label: string; description?: string }

/**
 * Alegerea unei înregistrări (contact, companie) cu căutare pe server.
 * Valoarea câmpului: id sau null. `initial` = eticheta valorii curente la deschidere.
 */
export function EntityPickerField<T extends FieldValues>({
  control,
  name,
  label,
  search,
  initial,
  placeholder,
}: {
  control: Control<T>
  name: FieldPath<T>
  label: string
  search: (input: { q: string }) => Promise<ActionResult<PickerOption[]>>
  initial?: PickerOption | null
  placeholder?: string
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [options, setOptions] = useState<PickerOption[]>([])
  const [chosen, setChosen] = useState<PickerOption | null>(initial ?? null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const id = setTimeout(async () => {
      const result = await search({ q })
      if (!cancelled && result.ok) setOptions(result.data)
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [open, q, search])

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
          <div className="flex gap-1">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  id={field.name}
                  type="button"
                  variant="outline"
                  className="min-w-0 flex-1 justify-between font-normal"
                >
                  <span className={field.value ? "truncate" : "truncate text-muted-foreground"}>
                    {field.value && chosen ? chosen.label : (placeholder ?? t("common.select"))}
                  </span>
                  <ChevronsUpDown className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-(--radix-popover-trigger-width) min-w-64 p-0"
                align="start"
              >
                <Command shouldFilter={false}>
                  <CommandInput value={q} onValueChange={setQ} placeholder={t("common.search")} />
                  <CommandList>
                    <CommandEmpty>{t("search.empty")}</CommandEmpty>
                    <CommandGroup>
                      {options.map((o) => (
                        <CommandItem
                          key={o.id}
                          value={o.id}
                          onSelect={() => {
                            setChosen(o)
                            field.onChange(o.id)
                            setOpen(false)
                          }}
                        >
                          <Check className={field.value === o.id ? "opacity-100" : "opacity-0"} />
                          <span className="min-w-0">
                            <span className="block truncate">{o.label}</span>
                            {o.description && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {o.description}
                              </span>
                            )}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {field.value && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => field.onChange(null)}
                aria-label={t("common.clear")}
              >
                <X />
              </Button>
            )}
          </div>
          {fieldState.error?.message && <FieldError>{t(fieldState.error.message)}</FieldError>}
        </Field>
      )}
    />
  )
}
