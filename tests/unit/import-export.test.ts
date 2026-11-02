import { describe, expect, it, vi } from "vitest"

import { toCsvDocument } from "@/lib/csv"
import type { CustomFieldDef } from "@/modules/crm-config/types"
import {
  buildBatches,
  countDataRows,
  rowValues,
  toParsedCsv,
} from "@/modules/import-export/batches"
import {
  autoMap,
  importCandidates,
  mappingError,
  normalizeHeader,
} from "@/modules/import-export/fields"
import { prepareRow, prepareRows, splitList } from "@/modules/import-export/rows"

import messages from "../../messages/ro.json"

vi.mock("server-only", () => ({}))

const fields = messages.importExport.fields as Record<string, string>
const label = (key: string) => fields[key] ?? key

const defs: CustomFieldDef[] = [
  {
    id: "1",
    entity: "contact",
    key: "birthday",
    label: "Zi de naștere",
    type: "date",
    options: [],
    isRequired: false,
  },
  {
    id: "2",
    entity: "contact",
    key: "vip",
    label: "VIP",
    type: "bool",
    options: [],
    isRequired: false,
  },
  {
    id: "3",
    entity: "contact",
    key: "segment",
    label: "Segment",
    type: "select",
    options: ["A", "B"],
    isRequired: true,
  },
]

describe("column mapping", () => {
  it("normalizes headers (diacritics, case, separators, parentheses)", () => {
    expect(normalizeHeader("  Oraș_Livrare ")).toBe("oras livrare")
    expect(normalizeHeader("Responsabil (e-mail)")).toBe("responsabil")
  })

  it("maps the app's own export headers back to the same fields", () => {
    const headers = [
      "Prenume",
      "Nume de familie",
      "Telefon",
      "E-mail",
      "Responsabil (e-mail)",
      "Zi de naștere",
    ]
    const mapping = autoMap(headers, importCandidates("contacts", label, defs))
    expect(mapping).toEqual([
      "first_name",
      "last_name",
      "phone",
      "email",
      "owner",
      "custom.birthday",
    ])
  })

  it("recognizes common aliases in several languages", () => {
    const mapping = autoMap(
      ["Name", "Mobile", "Фамилия", "Company", "Unknown"],
      importCandidates("contacts", label, [])
    )
    expect(mapping).toEqual(["full_name", "phone", "last_name", "company", ""])
  })

  it("maps a single-value field once, multi-value fields from several columns", () => {
    const mapping = autoMap(
      ["Telefon", "Tel", "Prenume", "First name"],
      importCandidates("contacts", label, [])
    )
    expect(mapping).toEqual(["phone", "phone", "first_name", ""])
  })

  it("requires a name column and rejects duplicate single fields", () => {
    expect(mappingError("contacts", ["phone", ""])).toBe("importExport.mapping.needName")
    expect(mappingError("contacts", ["full_name", "phone", "phone"])).toBeNull()
    expect(mappingError("contacts", ["first_name", "first_name"])).toBe(
      "importExport.mapping.duplicate"
    )
    expect(mappingError("companies", ["phone"])).toBe("importExport.mapping.needCompanyName")
    expect(mappingError("companies", ["name"])).toBeNull()
  })
})

describe("row validation", () => {
  const segment = { "custom.segment": "A" }

  it("splits a full name and normalizes phones and e-mails", () => {
    const result = prepareRow(
      "contacts",
      {
        full_name: "Ion  Popescu Junior",
        phone: "069 123 456, +373 79 111 222",
        email: "Ion@Example.MD",
        tags: "VIP; Nou",
        ...segment,
      },
      defs
    )
    expect(result).toMatchObject({
      ok: true,
      data: {
        first_name: "Ion",
        last_name: "Popescu Junior",
        phones: ["+37369123456", "+37379111222"],
        emails: ["ion@example.md"],
        tags: ["VIP", "Nou"],
      },
    })
  })

  it("converts custom field values written by people (dates, yes/no)", () => {
    const result = prepareRow(
      "contacts",
      { first_name: "Ana", "custom.birthday": "5.3.1990", "custom.vip": "Da", ...segment },
      defs
    )
    expect(result).toMatchObject({
      ok: true,
      data: { custom_fields: { birthday: "1990-03-05", vip: true, segment: "A" } },
    })
  })

  it("validates only the custom fields that are mapped", () => {
    expect(prepareRow("contacts", { first_name: "Ana" }, defs).ok).toBe(true)
    expect(prepareRow("contacts", { first_name: "Ana", "custom.segment": "C" }, defs)).toEqual({
      ok: false,
      code: "validation.option",
      field: "custom.segment",
    })
  })

  it("reports the first invalid field of a row", () => {
    expect(prepareRow("contacts", { first_name: "", last_name: " " }, [])).toEqual({
      ok: false,
      code: "validation.contactName",
      field: "first_name",
    })
    expect(prepareRow("contacts", { first_name: "Ion", email: "nu-e-email" }, [])).toEqual({
      ok: false,
      code: "validation.email",
      field: "email",
    })
    expect(prepareRow("contacts", { first_name: "Ion", phone: "069-abc" }, [])).toMatchObject({
      code: "validation.phone",
    })
    expect(prepareRow("contacts", { first_name: "x".repeat(81) }, [])).toMatchObject({
      code: "validation.tooLong",
      field: "first_name",
    })
  })

  it("prepares companies: required name, website with protocol, one phone", () => {
    expect(prepareRow("companies", { industry: "IT" }, [])).toMatchObject({
      code: "validation.required",
    })
    expect(
      prepareRow(
        "companies",
        { name: "Alfa", website: "alfa.md", phone: "022 123 456, 069 000 000" },
        []
      )
    ).toMatchObject({ ok: true, data: { website: "https://alfa.md", phone: "+37322123456" } })
    expect(prepareRow("companies", { name: "Alfa", website: "nu e site" }, [])).toMatchObject({
      code: "validation.url",
    })
  })

  it("splits a batch into rows for SQL and rows for the error report", () => {
    const { valid, errors } = prepareRows(
      "contacts",
      [
        { row: 2, values: { first_name: "Ion" } },
        { row: 3, values: { email: "x@y.md" } },
      ],
      []
    )
    expect(valid).toHaveLength(1)
    expect(valid[0]).toMatchObject({ row: 2, first_name: "Ion" })
    expect(errors).toEqual([{ row: 3, code: "validation.contactName", field: "first_name" }])
  })

  it("splits lists on commas, semicolons and new lines", () => {
    expect(splitList(" a, b;c\nd ,, ")).toEqual(["a", "b", "c", "d"])
  })
})

describe("batches", () => {
  it("names empty header columns and keeps file row numbers", () => {
    const csv = toParsedCsv([
      ["Prenume", ""],
      ["Ion", "x"],
      ["", ""],
      ["Ana", "y"],
    ])
    expect(csv.headers).toEqual(["Prenume", "#2"])
    expect(countDataRows(csv.records)).toBe(2)
    const [batch] = buildBatches(csv.records, ["first_name", ""])
    expect(batch!.map((r) => r.row)).toEqual([2, 4])
  })

  it("removes the anti-formula apostrophe added by exports", () => {
    expect(rowValues(["'=SUM(A1)", "'+373 69 123 456"], ["position", "phone"])).toEqual({
      position: "=SUM(A1)",
      phone: "+373 69 123 456",
    })
  })

  it("joins columns mapped to the same multi-value field", () => {
    expect(rowValues(["069", "079", " Ion "], ["phone", "phone", "first_name"])).toEqual({
      phone: "069, 079",
      first_name: "Ion",
    })
  })

  it("sends 10 000 rows in batches of at most 500", () => {
    const records = Array.from({ length: 10_000 }, (_, i) => [`Contact ${i}`, `+3736900${i}`])
    const batches = buildBatches(records, ["full_name", "phone"])
    expect(batches).toHaveLength(20)
    expect(batches.every((b) => b.length <= 500)).toBe(true)
    expect(batches.at(-1)!.at(-1)!.row).toBe(10_001)
  })
})

describe("CSV export", () => {
  it("adds a BOM, quotes separators and protects against formulas", () => {
    const csv = toCsvDocument(
      ["Nume", "Notă"],
      [
        ["Ion; Ana", "=1+1"],
        [null, 5],
      ]
    )
    expect(csv.startsWith("﻿")).toBe(true)
    expect(csv).toContain('"Ion; Ana";\'=1+1')
    expect(csv).toContain("\r\n;5\r\n")
  })

  it("leaves numbers and phone numbers unchanged so they can be re-imported", () => {
    const csv = toCsvDocument(["T"], [["+373 69 123 456"], ["-15"], ["-1+cmd|x"]])
    expect(csv).toContain("+373 69 123 456\r\n-15\r\n'-1+cmd|x\r\n")
  })
})
