/** Diferența (minute) dintre ora locală din `timeZone` și UTC, la momentul `timestamp`. */
function offsetMinutes(timestamp: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(timestamp))
      .map((p) => [p.type, Number(p.value)])
  ) as Record<string, number>
  const asUtc = Date.UTC(
    parts.year!,
    parts.month! - 1,
    parts.day!,
    parts.hour!,
    parts.minute!,
    parts.second!
  )
  return Math.round((asUtc - timestamp) / 60000)
}

/** „2026-11-05T14:30” (ora locală a organizației) → momentul UTC corespunzător. */
export function zonedInputToUtc(local: string, timeZone: string): Date {
  const [date, time] = local.split("T") as [string, string]
  const [y, m, d] = date.split("-").map(Number) as [number, number, number]
  const [h, min] = time.split(":").map(Number) as [number, number]
  const guess = Date.UTC(y, m - 1, d, h, min)
  // Două treceri: corecție la trecerea ora de vară / iarnă.
  const first = guess - offsetMinutes(guess, timeZone) * 60000
  return new Date(guess - offsetMinutes(first, timeZone) * 60000)
}

/** Moment UTC → valoarea pentru <input type="datetime-local"> în fusul organizației. */
export function utcToZonedInput(value: string | Date, timeZone: string): string {
  const ts = new Date(value).getTime()
  const local = new Date(ts + offsetMinutes(ts, timeZone) * 60000)
  return local.toISOString().slice(0, 16)
}
