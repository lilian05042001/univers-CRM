"use client"

import { useTranslations } from "next-intl"

import { FilterSelect } from "@/components/shared/data-table/toolbar"
import type { NamedOption } from "@/modules/crm-config/types"

import type { Period } from "../period"

import { PeriodFilter } from "./period-filter"

export type FilterKey = "pipeline" | "team" | "responsible" | "source"

/** Bara de filtre comună: perioadă + filtrele relevante pentru raport, toate în URL. */
export function ReportFilters({
  period,
  options,
  show,
  pipelineAll = true,
}: {
  period: { period: Period; fromDate: string; toDate: string }
  options: Record<FilterKey, NamedOption[]>
  show: FilterKey[]
  /** Pâlnia are mereu un pipeline (implicit cel principal). */
  pipelineAll?: boolean
}) {
  const t = useTranslations("reports.filters")

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PeriodFilter period={period.period} from={period.fromDate} to={period.toDate} />
      {show
        .filter((key) => options[key].length > (key === "pipeline" && pipelineAll ? 1 : 0))
        .map((key) => (
          <FilterSelect
            key={key}
            param={key}
            label={t(key)}
            allLabel={key === "pipeline" && !pipelineAll ? t("defaultPipeline") : undefined}
            options={options[key].map((o) => ({ value: o.id, label: o.name }))}
          />
        ))}
    </div>
  )
}
