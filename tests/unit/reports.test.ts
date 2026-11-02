import { describe, expect, it } from "vitest"

import { toCsv } from "@/modules/reports/csv"
import { bucketFor, resolvePeriod } from "@/modules/reports/period"

const TZ = "Europe/Chisinau"
// 2 noiembrie 2026, 01:30 la Chișinău (încă 1 noiembrie în UTC).
const NOW = new Date("2026-11-01T23:30:00Z")

describe("report periods", () => {
  it("uses the organization's calendar day, not UTC", () => {
    const p = resolvePeriod({ period: "today" }, TZ, NOW)
    expect(p.fromDate).toBe("2026-11-02")
    expect(p.start.toISOString()).toBe("2026-11-01T22:00:00.000Z")
    expect(p.end.toISOString()).toBe("2026-11-02T22:00:00.000Z")
  })

  it("defaults to the last 30 days including today", () => {
    const p = resolvePeriod({}, TZ, NOW)
    expect(p).toMatchObject({
      period: "30d",
      fromDate: "2026-10-04",
      toDate: "2026-11-02",
      bucket: "day",
    })
  })

  it("resolves the previous month across the DST change", () => {
    const p = resolvePeriod({ period: "last_month" }, TZ, NOW)
    expect(p.fromDate).toBe("2026-10-01")
    expect(p.toDate).toBe("2026-10-31")
    expect(p.start.toISOString()).toBe("2026-09-30T21:00:00.000Z") // UTC+3 (vară)
    expect(p.end.toISOString()).toBe("2026-10-31T22:00:00.000Z") // UTC+2 (iarnă)
  })

  it("accepts a valid custom range and falls back on an invalid one", () => {
    expect(
      resolvePeriod({ period: "custom", from: "2026-01-01", to: "2026-06-30" }, TZ, NOW)
    ).toMatchObject({
      period: "custom",
      bucket: "week",
    })
    expect(
      resolvePeriod({ period: "custom", from: "2026-06-30", to: "2026-01-01" }, TZ, NOW).period
    ).toBe("30d")
    expect(resolvePeriod({ period: "custom", from: "x", to: "y" }, TZ, NOW).period).toBe("30d")
  })

  it("chooses the chart granularity from the length", () => {
    expect(bucketFor(1)).toBe("day")
    expect(bucketFor(62)).toBe("day")
    expect(bucketFor(90)).toBe("week")
    expect(bucketFor(365)).toBe("month")
  })
})

describe("csv export", () => {
  const columns = [
    { key: "name", kind: "text" as const },
    { key: "won_amount", kind: "money" as const },
  ]

  it("writes a BOM, semicolons, escaped quotes and raw numbers", () => {
    const csv = toCsv(
      columns,
      [
        { name: 'Ana "A"; Rusu', won_amount: 12500.5 },
        { name: null, won_amount: 0 },
      ],
      (c) => (c.key === "name" ? "Nume" : "Vânzări"),
      "Neatribuit"
    )
    expect(csv).toBe('﻿Nume;Vânzări\r\n"Ana ""A""; Rusu";12500.5\r\nNeatribuit;0\r\n')
  })

  it("neutralizes spreadsheet formulas in text cells", () => {
    const csv = toCsv(columns, [{ name: "=HYPERLINK(1)", won_amount: -5 }], () => "h", "")
    expect(csv.split("\r\n")[1]).toBe("'=HYPERLINK(1);-5")
  })
})
