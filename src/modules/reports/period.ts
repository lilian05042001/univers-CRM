import { addDays, zonedInputToUtc, zonedToday } from "@/lib/utils/timezone"

export const PERIODS = ["today", "7d", "30d", "month", "last_month", "90d", "custom"] as const
export type Period = (typeof PERIODS)[number]

export type Bucket = "day" | "week" | "month"

export type ResolvedPeriod = {
  period: Period
  /** Zilele locale incluse: [fromDate, toDate] (afișare, câmpurile „personalizat”). */
  fromDate: string
  toDate: string
  /** Intervalul UTC [start, end) trimis funcțiilor SQL. */
  start: Date
  end: Date
  bucket: Bucket
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

function monthStart(date: string, offsetMonths = 0) {
  const [y, m] = date.split("-").map(Number) as [number, number]
  return new Date(Date.UTC(y, m - 1 + offsetMonths, 1)).toISOString().slice(0, 10)
}

/** Granularitatea graficelor: zile până la ~2 luni, apoi săptămâni, apoi luni. */
export function bucketFor(days: number): Bucket {
  return days <= 62 ? "day" : days <= 200 ? "week" : "month"
}

/**
 * Perioada din URL (`period`, `from`, `to`), în fusul organizației.
 * Implicit: ultimele 30 de zile, inclusiv azi.
 */
export function resolvePeriod(
  params: { period?: string; from?: string; to?: string },
  timeZone: string,
  now: Date = new Date()
): ResolvedPeriod {
  const today = zonedToday(timeZone, now)
  let period = (PERIODS as readonly string[]).includes(params.period ?? "")
    ? (params.period as Period)
    : "30d"
  let fromDate: string
  let toDate = today

  switch (period) {
    case "today":
      fromDate = today
      break
    case "7d":
      fromDate = addDays(today, -6)
      break
    case "90d":
      fromDate = addDays(today, -89)
      break
    case "month":
      fromDate = monthStart(today)
      break
    case "last_month":
      fromDate = monthStart(today, -1)
      toDate = addDays(monthStart(today), -1)
      break
    case "custom":
      if (
        params.from &&
        params.to &&
        DATE.test(params.from) &&
        DATE.test(params.to) &&
        params.from <= params.to &&
        daysBetween(params.from, params.to) <= 3660
      ) {
        fromDate = params.from
        toDate = params.to
        break
      }
      period = "30d"
      fromDate = addDays(today, -29)
      break
    default:
      fromDate = addDays(today, -29)
  }

  return {
    period,
    fromDate,
    toDate,
    start: zonedInputToUtc(`${fromDate}T00:00`, timeZone),
    end: zonedInputToUtc(`${addDays(toDate, 1)}T00:00`, timeZone),
    bucket: bucketFor(daysBetween(fromDate, toDate) + 1),
  }
}
