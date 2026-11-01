import { describe, expect, it } from "vitest"

import { addDays, zonedRange } from "@/lib/utils/timezone"
import { shiftDate, startOfWeek, visibleRange, weekdayIndex } from "@/modules/calendar/utils"

describe("calendar utils", () => {
  it("weeks start on Monday", () => {
    expect(weekdayIndex("2026-11-02")).toBe(0) // luni
    expect(weekdayIndex("2026-11-01")).toBe(6) // duminică
    expect(startOfWeek("2026-11-01")).toBe("2026-10-26")
  })

  it("month view shows six full weeks starting on the Monday before the 1st", () => {
    expect(visibleRange("month", "2026-11-17")).toEqual({ from: "2026-10-26", days: 42 })
    expect(visibleRange("week", "2026-11-05")).toEqual({ from: "2026-11-02", days: 7 })
    expect(visibleRange("day", "2026-11-05")).toEqual({ from: "2026-11-05", days: 1 })
  })

  it("navigates by month, week and day", () => {
    expect(shiftDate("month", "2026-01-31", 1)).toBe("2026-02-01")
    expect(shiftDate("month", "2026-01-15", -1)).toBe("2025-12-01")
    expect(shiftDate("week", "2026-11-05", 1)).toBe("2026-11-12")
    expect(shiftDate("day", "2026-12-31", 1)).toBe("2027-01-01")
  })

  it("computes local day ranges in UTC across DST", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26")
    const { start, end } = zonedRange("2026-10-25", 1, "Europe/Chisinau")
    // 25 octombrie are 25 de ore (trecerea la ora de iarnă).
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(25)
  })
})
