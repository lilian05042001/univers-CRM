import type { SelectOption } from "@/components/shared/form/select-field"
import type { MultiOption } from "@/components/shared/form/multi-select-field"

import type { NamedOption, TagOption } from "./types"

export const toSelectOptions = (items: NamedOption[]): SelectOption[] =>
  items.map((i) => ({ value: i.id, label: i.name }))

export const toTagOptions = (tags: TagOption[]): MultiOption[] =>
  tags.map((t) => ({ value: t.id, label: t.name }))

export const nameById = (items: NamedOption[]) => {
  const map = new Map(items.map((i) => [i.id, i.name]))
  return (id: string | null | undefined) => (id ? map.get(id) : undefined)
}
