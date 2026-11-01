export type StageKind = "open" | "won" | "lost"

export type StageOption = {
  id: string
  name: string
  color: string
  kind: StageKind
  position: number
  probability: number
}
export type PipelineOption = { id: string; name: string; isDefault: boolean; stages: StageOption[] }
export type TagOption = { id: string; name: string; color: string }
export type NamedOption = { id: string; name: string }

export type CustomFieldType = "text" | "number" | "date" | "select" | "multiselect" | "bool" | "url"
export type CustomFieldEntity = "lead" | "contact" | "company"

export type CustomFieldDef = {
  id: string
  entity: CustomFieldEntity
  key: string
  label: string
  type: CustomFieldType
  options: string[]
  isRequired: boolean
}

/** Opțiunile comune pentru formulare și filtre (serializabile, trimise componentelor client). */
export type CrmOptions = {
  pipelines: PipelineOption[]
  sources: NamedOption[]
  tags: TagOption[]
  lossReasons: NamedOption[]
  members: NamedOption[]
  teams: NamedOption[]
  customFields: CustomFieldDef[]
}
