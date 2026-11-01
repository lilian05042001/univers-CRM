import { describe, expect, it } from "vitest"

import { utcToZonedInput, zonedInputToUtc } from "@/lib/utils/timezone"
import { isAllowedFile, MAX_FILE_BYTES, storagePath } from "@/modules/files/constants"

const TZ = "Europe/Chisinau"

describe("timezone conversion", () => {
  it("converts local winter time (UTC+2) to UTC", () => {
    expect(zonedInputToUtc("2026-12-15T10:00", TZ).toISOString()).toBe("2026-12-15T08:00:00.000Z")
  })

  it("converts local summer time (UTC+3) to UTC", () => {
    expect(zonedInputToUtc("2026-07-15T10:00", TZ).toISOString()).toBe("2026-07-15T07:00:00.000Z")
  })

  it("round-trips across the DST change", () => {
    for (const local of ["2026-03-29T05:00", "2026-10-25T05:00", "2026-11-05T14:30"]) {
      expect(utcToZonedInput(zonedInputToUtc(local, TZ), TZ)).toBe(local)
    }
  })
})

describe("file uploads", () => {
  it("accepts documents and images within the size limit", () => {
    expect(isAllowedFile("oferta.pdf", 1000)).toBe(true)
    expect(isAllowedFile("poza.JPG", MAX_FILE_BYTES)).toBe(true)
  })

  it("rejects executables, scripts, empty and oversized files", () => {
    expect(isAllowedFile("virus.exe", 10)).toBe(false)
    expect(isAllowedFile("pagina.HTML", 10)).toBe(false)
    expect(isAllowedFile("imagine.svg", 10)).toBe(false)
    expect(isAllowedFile("gol.pdf", 0)).toBe(false)
    expect(isAllowedFile("mare.pdf", MAX_FILE_BYTES + 1)).toBe(false)
  })

  it("builds a sanitized path inside the organization folder", () => {
    const path = storagePath("org-1", "lead", "lead-1", "../Ofertă finală (v2).pdf")
    expect(path).toMatch(/^org-1\/lead\/lead-1\/[0-9a-f-]{36}-_Oferta_finala_v2_\.pdf$/)
    expect(storagePath("o", "lead", "l", "raport..final.pdf")).not.toContain("..")
    expect(path.split("/")).toHaveLength(4)
  })
})
