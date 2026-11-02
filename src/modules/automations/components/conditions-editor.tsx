"use client"

import { Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect } from "react"
import { useFieldArray, useWatch, type Control, type UseFormSetValue } from "react-hook-form"

import { SelectField } from "@/components/shared/form/select-field"
import { TextField } from "@/components/shared/form/text-field"
import { Button } from "@/components/ui/button"

import {
  CONDITION_FIELDS,
  NO_VALUE_OPERATORS,
  OPERATORS_BY_KIND,
  fieldKind,
  i18nKey,
  valueOptions,
  type EditorOptions,
} from "../fields"
import type { AutomationInput } from "../schemas"

type FormProps = {
  control: Control<AutomationInput>
  setValue: UseFormSetValue<AutomationInput>
  options: EditorOptions
}

function RuleRow({
  control,
  setValue,
  options,
  index,
  onRemove,
}: FormProps & { index: number; onRemove: () => void }) {
  const t = useTranslations("automations.conditions")
  const tPriority = useTranslations("leads.priority")
  const field = useWatch({ control, name: `rules.${index}.field` })
  const operator = useWatch({ control, name: `rules.${index}.operator` })
  const kind = fieldKind(field)
  const allowed = OPERATORS_BY_KIND[kind]
  const values = valueOptions(kind, options, (p) => tPriority(p))

  // Alt câmp → alți operatori și altă valoare.
  useEffect(() => {
    if (!allowed.includes(operator)) {
      setValue(`rules.${index}.operator`, allowed[0]!)
      setValue(`rules.${index}.value`, "")
    }
  }, [allowed, operator, index, setValue])

  return (
    <div className="grid items-start gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <SelectField
        control={control}
        name={`rules.${index}.field`}
        label={t("field")}
        options={CONDITION_FIELDS.map((c) => ({
          value: c.key,
          label: t(`fields.${i18nKey(c.key)}`),
        }))}
      />
      <SelectField
        control={control}
        name={`rules.${index}.operator`}
        label={t("operator")}
        options={allowed.map((o) => ({ value: o, label: t(`operators.${o}`) }))}
      />
      {NO_VALUE_OPERATORS.includes(operator) ? (
        <div className="max-sm:hidden" />
      ) : values ? (
        <SelectField
          control={control}
          name={`rules.${index}.value`}
          label={t("value")}
          options={values}
        />
      ) : (
        <TextField
          control={control}
          name={`rules.${index}.value`}
          label={t("value")}
          inputMode={kind === "number" ? "decimal" : undefined}
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="sm:mt-7"
        aria-label={t("remove")}
        onClick={onRemove}
      >
        <Trash2 />
      </Button>
    </div>
  )
}

/** Reguli câmp – operator – valoare, combinate cu „toate” (AND) sau „oricare” (OR). */
export function ConditionsEditor(props: FormProps) {
  const t = useTranslations("automations.conditions")
  const { fields, append, remove } = useFieldArray({ control: props.control, name: "rules" })

  return (
    <div className="flex flex-col gap-3">
      {fields.length > 1 && (
        <div className="max-w-xs">
          <SelectField
            control={props.control}
            name="conditionOp"
            label={t("combine")}
            options={[
              { value: "and", label: t("and") },
              { value: "or", label: t("or") },
            ]}
          />
        </div>
      )}
      {fields.length === 0 && <p className="text-sm text-muted-foreground">{t("none")}</p>}
      {fields.map((f, i) => (
        <RuleRow key={f.id} {...props} index={i} onRemove={() => remove(i)} />
      ))}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append({ field: "lead.value", operator: "gte", value: "" })}
        >
          <Plus />
          {t("add")}
        </Button>
      </div>
    </div>
  )
}
