export const REPORT_KEYS = [
  "leads",
  "sales",
  "funnel",
  "team",
  "sources",
  "activities",
  "losses",
] as const
export type ReportKey = (typeof REPORT_KEYS)[number]

export type ColumnKind = "text" | "int" | "money" | "percent" | "days" | "date" | "month" | "week"

/** Coloană de tabel / CSV; eticheta e cheia i18n reports.columns.<key>. */
export type ReportColumn = { key: string; kind: ColumnKind }

export type ReportRow = Record<string, string | number | null>

export type ChartSpec = {
  type: "bar" | "line"
  /** Coloana categoriei (axa X, sau Y pentru bare orizontale). */
  x: string
  series: string[]
  /** Slotul de culoare al fiecărei serii (1-based, --chart-N); implicit în ordine. */
  colors?: number[]
  horizontal?: boolean
  /** Tipul valorilor (formatarea axei și a tooltip-ului). */
  valueKind: "int" | "money"
}

export type ReportData = {
  columns: ReportColumn[]
  rows: ReportRow[]
  chart: ChartSpec | null
  currency: string
}

export type ReportFilters = {
  pipelineId: string | null
  responsibleId: string | null
  teamId: string | null
  sourceId: string | null
}
