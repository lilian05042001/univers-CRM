import { addDays } from "@/lib/utils/timezone"

export const CALENDAR_VIEWS = ["month", "week", "day"] as const
export type CalendarView = (typeof CALENDAR_VIEWS)[number]

/** Ziua săptămânii (0 = luni … 6 = duminică) pentru o dată „YYYY-MM-DD”. */
export function weekdayIndex(date: string): number {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7
}

export const startOfWeek = (date: string) => addDays(date, -weekdayIndex(date))

/** Prima zi afișată și numărul de zile pentru vederea aleasă (luna: 6 săptămâni complete). */
export function visibleRange(view: CalendarView, date: string): { from: string; days: number } {
  if (view === "day") return { from: date, days: 1 }
  if (view === "week") return { from: startOfWeek(date), days: 7 }
  return { from: startOfWeek(`${date.slice(0, 7)}-01`), days: 42 }
}

/** Data următoare / anterioară pentru navigare. */
export function shiftDate(view: CalendarView, date: string, direction: 1 | -1): string {
  if (view === "day") return addDays(date, direction)
  if (view === "week") return addDays(date, 7 * direction)
  const [y, m] = date.split("-").map(Number) as [number, number]
  const next = new Date(Date.UTC(y, m - 1 + direction, 1))
  return next.toISOString().slice(0, 10)
}

/** O dată calendaristică ca obiect Date stabil (amiaza UTC), pentru formatare. */
export const dateValue = (date: string) => new Date(`${date}T12:00:00Z`)
