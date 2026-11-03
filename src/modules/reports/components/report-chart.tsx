"use client"

import { useLocale, useTranslations } from "next-intl"
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

import type { ChartSpec, ReportColumn, ReportRow } from "../types"

import { useReportFormat } from "./use-report-format"

/**
 * Graficul unui raport: o singură axă de valori, culori în ordinea fixă a paletei (--chart-1…),
 * legendă de la 2 serii, tooltip la hover. Tabelul de sub grafic e vederea accesibilă.
 */
export function ReportChart({
  spec,
  rows,
  columns,
  currency,
  className,
}: {
  spec: ChartSpec
  rows: ReportRow[]
  columns: ReportColumn[]
  currency: string
  className?: string
}) {
  const t = useTranslations("reports.columns")
  const locale = useLocale()
  const fmt = useReportFormat(currency)
  const xKind = columns.find((c) => c.key === spec.x)?.kind ?? "text"
  const config: ChartConfig = Object.fromEntries(
    spec.series.map((key, i) => [
      key,
      { label: t(key), color: `var(--chart-${spec.colors?.[i] ?? i + 1})` },
    ])
  )
  const data = rows.map((r) => ({ ...r, [spec.x]: fmt(r[spec.x], xKind) }))
  const value = (v: unknown) => fmt(v as number, spec.valueKind)
  const compact = (v: unknown) =>
    spec.valueKind === "money"
      ? new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(
          Number(v)
        )
      : String(v)
  const legend = spec.series.length > 1 && <ChartLegend content={<ChartLegendContent />} />
  const tooltip = (
    <ChartTooltip
      cursor={spec.type === "line" ? true : { fillOpacity: 0.4 }}
      content={
        <ChartTooltipContent
          formatter={(v, name) => (
            <span className="flex w-full justify-between gap-4">
              <span className="text-muted-foreground">{config[String(name)]?.label}</span>
              <span className="font-medium tabular-nums">{value(v)}</span>
            </span>
          )}
        />
      }
    />
  )

  if (spec.type === "line") {
    return (
      <ChartContainer config={config} className={className ?? "aspect-auto h-72 w-full"}>
        <LineChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey={spec.x}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            allowDecimals={false}
            tickFormatter={compact}
          />
          {tooltip}
          {legend}
          {spec.series.map((key) => (
            <Line
              key={key}
              dataKey={key}
              type="monotone"
              stroke={`var(--color-${key})`}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ChartContainer>
    )
  }

  if (spec.horizontal) {
    return (
      <ChartContainer
        config={config}
        className={className ?? "aspect-auto w-full"}
        style={{ height: Math.max(160, data.length * (spec.series.length > 1 ? 44 : 34) + 40) }}
      >
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16 }} barGap={2}>
          <CartesianGrid horizontal={false} />
          <YAxis dataKey={spec.x} type="category" tickLine={false} axisLine={false} width={150} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tickFormatter={compact}
          />
          {tooltip}
          {legend}
          {spec.series.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              fill={`var(--color-${key})`}
              radius={[0, 4, 4, 0]}
              maxBarSize={18}
            />
          ))}
        </BarChart>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer config={config} className={className ?? "aspect-auto h-72 w-full"}>
      <BarChart data={data} margin={{ left: 4, right: 12, top: 8 }} barGap={2}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey={spec.x} tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          allowDecimals={false}
          tickFormatter={compact}
        />
        {tooltip}
        {legend}
        {spec.series.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            fill={`var(--color-${key})`}
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
