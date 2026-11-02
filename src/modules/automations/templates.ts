import type { TriggerType } from "@/lib/automation-engine/types"

import type { EditorOptions } from "./fields"
import { emptyAction, type ActionInput, type AutomationInput } from "./schemas"

/** Cele 6 scenarii de pornire (Etapa 9). Textele vin din i18n: automations.templates.<cheie>. */
export const TEMPLATE_KEYS = [
  "assignOnCreate",
  "taskOnStage",
  "dueSoonReminder",
  "lossReason",
  "wonRevenue",
  "inactiveReminder",
] as const
export type TemplateKey = (typeof TEMPLATE_KEYS)[number]

export const TEMPLATE_TRIGGERS: Record<TemplateKey, TriggerType> = {
  assignOnCreate: "lead.created",
  taskOnStage: "lead.stage_entered",
  dueSoonReminder: "task.due_soon",
  lossReason: "lead.lost",
  wonRevenue: "lead.won",
  inactiveReminder: "lead.inactive",
}

/** Valorile formularului pentru un șablon; textele (nume, titluri) sunt traduse de apelant. */
export function templateValues(
  key: TemplateKey,
  options: EditorOptions,
  text: (key: string) => string
): AutomationInput {
  const pipeline = options.pipelines.find((p) => p.isDefault) ?? options.pipelines[0]
  const open = pipeline?.stages.filter((s) => s.kind === "open") ?? []
  const action = (type: ActionInput["type"], extra: Partial<ActionInput> = {}): ActionInput => ({
    ...emptyAction(type),
    ...extra,
  })
  // Leneș: fiecare șablon citește doar propriile texte.
  const actions: Record<TemplateKey, () => ActionInput[]> = {
    assignOnCreate: () => [
      action("assign_responsible", { user_ids: options.members.map((m) => m.id) }),
    ],
    taskOnStage: () => [
      action("create_task", { title: text(`${key}.task`), due_in_hours: "48", priority: "high" }),
    ],
    dueSoonReminder: () => [action("notify", { message: text(`${key}.message`) })],
    lossReason: () => [action("require_loss_reason")],
    wonRevenue: () => [
      action("record_revenue"),
      action("notify", { message: text(`${key}.message`) }),
    ],
    inactiveReminder: () => [
      action("create_task", { title: text(`${key}.task`), due_in_hours: "4" }),
    ],
  }

  return {
    name: text(`${key}.name`),
    description: text(`${key}.description`),
    triggerType: TEMPLATE_TRIGGERS[key],
    // „Ofertă prezentată” în pipeline-ul implicit: penultima etapă deschisă.
    stageId: key === "taskOnStage" ? (open.at(-2)?.id ?? open[0]?.id ?? null) : null,
    minutes: "60",
    days: "7",
    pipelineId: key === "taskOnStage" ? (pipeline?.id ?? null) : null,
    conditionOp: "and",
    rules: [],
    actions: actions[key](),
    isActive: true,
  }
}
