"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { FormError } from "@/components/shared/form/form-error"
import { MultiSelectField } from "@/components/shared/form/multi-select-field"
import { SelectField } from "@/components/shared/form/select-field"
import { Button } from "@/components/ui/button"
import { FieldDescription, FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { applyActionResult } from "@/lib/actions/apply-result"
import type { NamedOption } from "@/modules/crm-config/types"

import type { AssignmentRule } from "../queries"
import { ASSIGNMENT_STRATEGIES, assignmentRuleSchema, type AssignmentRuleInput } from "../schemas"
import { saveAssignmentRule } from "../settings-actions"

/** Cine primește automat lead-urile noi fără responsabil din acest pipeline. */
export function AssignmentRuleForm({
  pipelineId,
  rule,
  members,
}: {
  pipelineId: string
  rule: AssignmentRule | undefined
  members: NamedOption[]
}) {
  const t = useTranslations("settings.pipelines.assignment")
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<AssignmentRuleInput>({
    resolver: zodResolver(assignmentRuleSchema),
    defaultValues: { pipelineId, strategy: rule?.strategy ?? "none", userIds: rule?.userIds ?? [] },
  })
  const strategy = useWatch({ control: form.control, name: "strategy" })

  async function onSubmit(values: AssignmentRuleInput) {
    setError(null)
    const result = await saveAssignmentRule(values)
    if (!result.ok) {
      setError(applyActionResult(form, result))
      return
    }
    toast.success(t("saved"))
    form.reset(values)
    router.refresh()
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <FormError error={error} />
        <SelectField
          control={form.control}
          name="strategy"
          label={t("strategy")}
          options={ASSIGNMENT_STRATEGIES.map((s) => ({ value: s, label: t(`strategies.${s}`) }))}
        />
        <FieldDescription>{t(`hints.${strategy}`)}</FieldDescription>
        {strategy !== "none" && (
          <MultiSelectField
            control={form.control}
            name="userIds"
            label={t("users")}
            options={members.map((m) => ({ value: m.id, label: m.name }))}
          />
        )}
        <Button
          type="submit"
          className="w-fit"
          disabled={form.formState.isSubmitting || !form.formState.isDirty}
        >
          {form.formState.isSubmitting && <Spinner />}
          {t("save")}
        </Button>
      </FieldGroup>
    </form>
  )
}
