import { describe, expect, it } from "vitest"

import { parseListParams } from "@/lib/list-params"
import { formatPhone, normalizePhone } from "@/lib/utils/phone"
import { containsPattern, normalizeSearch, technicalKey } from "@/lib/utils/search"
import { parseCustomFields, toFormValues } from "@/modules/crm-config/custom-fields"
import type { CustomFieldDef } from "@/modules/crm-config/types"
import { parseAmount } from "@/modules/leads/schemas"

describe("search normalization", () => {
  it("removes Romanian diacritics and lowercases (same as SQL search_norm)", () => {
    expect(normalizeSearch("  Ștefan ȚURCAN Ăâî ")).toBe("stefan turcan aai")
  })

  it("keeps digits intact", () => {
    expect(normalizeSearch("069123456")).toBe("069123456")
  })

  it("escapes ILIKE wildcards", () => {
    expect(containsPattern("50%_off")).toBe("%50\\%\\_off%")
  })

  it("builds technical keys without diacritics", () => {
    expect(technicalKey("Câmp special!", "f", "ab12")).toBe("camp_special_ab12")
    expect(technicalKey("123 test", "f", "ab12")).toBe("f_123_test_ab12")
  })
})

describe("phones", () => {
  it("normalizes Moldovan numbers to E.164", () => {
    expect(normalizePhone("069 123 456")).toBe("+37369123456")
    expect(normalizePhone("+373 (69) 12-34-56")).toBe("+37369123456")
    expect(normalizePhone("0037369123456")).toBe("+37369123456")
  })

  it("keeps unparseable input as typed", () => {
    expect(normalizePhone("interior 12")).toBe("interior 12")
  })

  it("formats E.164 for display", () => {
    expect(formatPhone("+37369123456")).toBe("+373 691 23 456")
  })
})

describe("custom fields", () => {
  const defs: CustomFieldDef[] = [
    {
      id: "1",
      entity: "lead",
      key: "budget",
      label: "Buget",
      type: "number",
      options: [],
      isRequired: true,
    },
    {
      id: "2",
      entity: "lead",
      key: "segment",
      label: "Segment",
      type: "select",
      options: ["A", "B"],
      isRequired: false,
    },
    {
      id: "3",
      entity: "lead",
      key: "vip",
      label: "VIP",
      type: "bool",
      options: [],
      isRequired: false,
    },
  ]

  it("converts valid values for storage", () => {
    expect(parseCustomFields(defs, { budget: "12,5", segment: "B", vip: true })).toEqual({
      ok: true,
      data: { budget: 12.5, segment: "B", vip: true },
    })
  })

  it("reports required, invalid numbers and unknown options", () => {
    expect(parseCustomFields(defs, { budget: "", segment: "Z" })).toEqual({
      ok: false,
      errors: { budget: "validation.required", segment: "validation.option" },
    })
    expect(parseCustomFields(defs, { budget: "abc" })).toMatchObject({
      errors: { budget: "validation.number" },
    })
  })

  it("ignores keys that are not defined for the organization", () => {
    expect(parseCustomFields(defs, { budget: "1", hacked: "x" })).toEqual({
      ok: true,
      data: { budget: 1 },
    })
  })

  it("maps stored values back to form values", () => {
    expect(toFormValues(defs, { budget: 10 })).toEqual({ budget: "10", segment: "", vip: false })
  })
})

describe("list params", () => {
  it("validates page, size and sort against allowed values", () => {
    const p = parseListParams(
      { page: "3", size: "50", sort: "value", dir: "asc", q: "abc", stage: "x" },
      { sortKeys: ["created_at", "value"] as const, defaultSort: "created_at" }
    )
    expect([p.page, p.pageSize, p.sort, p.dir, p.q, p.get("stage")]).toEqual([
      3,
      50,
      "value",
      "asc",
      "abc",
      "x",
    ])
  })

  it("falls back to defaults for invalid input", () => {
    const p = parseListParams(
      { page: "-1", size: "7", sort: "drop table", dir: "sideways" },
      { sortKeys: ["created_at"] as const, defaultSort: "created_at" }
    )
    expect([p.page, p.pageSize, p.sort, p.dir]).toEqual([1, 25, "created_at", "desc"])
  })
})

describe("amounts", () => {
  it("parses Romanian-formatted amounts", () => {
    expect(parseAmount("12 500,50")).toBe(12500.5)
    expect(parseAmount("")).toBe(0)
  })
})
