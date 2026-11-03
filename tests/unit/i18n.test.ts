import { createTranslator } from "next-intl"
import { describe, expect, it } from "vitest"

import { csvResponse } from "@/lib/csv"
import { localeFromAcceptLanguage } from "@/lib/i18n/config"

import en from "../../messages/en.json"
import ro from "../../messages/ro.json"
import ru from "../../messages/ru.json"

type Messages = { [key: string]: string | Messages }

function flatten(node: Messages, prefix = ""): Record<string, string> {
  return Object.entries(node).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === "string"
      ? { ...acc, [path]: value }
      : { ...acc, ...flatten(value, path) }
  }, {})
}

const ARG = /\{\s*([a-zA-Z_]\w*)\s*[,}]/g
const argsOf = (text: string) => [...new Set([...text.matchAll(ARG)].map((m) => m[1]))].sort()

const source = flatten(ro)

describe("source messages (ro)", () => {
  it("every message is valid ICU and renders", () => {
    const errors: string[] = []
    const t = createTranslator({
      locale: "ro",
      messages: ro,
      onError: (e) => errors.push(e.message),
    })
    for (const key of Object.keys(source)) {
      const values = Object.fromEntries(argsOf(source[key]!).map((a) => [a, 3]))
      t(key as never, values as never)
    }
    expect(errors).toEqual([])
  })
})

describe.each([
  ["en", en],
  ["ru", ru],
])("translations: %s", (locale, messages) => {
  const translated = flatten(messages as Messages)

  it("has exactly the Romanian keys", () => {
    expect(Object.keys(translated).sort()).toEqual(Object.keys(source).sort())
  })

  it("keeps the same placeholders in every message", () => {
    const mismatched = Object.keys(source).filter(
      (key) => argsOf(source[key]!).join() !== argsOf(translated[key] ?? "").join()
    )
    expect(mismatched).toEqual([])
  })

  it("every message is valid ICU and renders", () => {
    const errors: string[] = []
    const t = createTranslator({
      locale,
      messages: messages as Messages,
      onError: (error) => errors.push(error.message),
    })
    for (const key of Object.keys(source)) {
      const values = Object.fromEntries(argsOf(source[key]!).map((a) => [a, 3]))
      expect(t(key as never, values as never)).not.toBe("")
    }
    expect(errors).toEqual([])
  })

  it("is actually translated (not a copy of Romanian)", () => {
    const same = Object.keys(source).filter((key) => translated[key] === source[key])
    expect(same.length / Object.keys(source).length).toBeLessThan(0.15)
  })
})

describe("locale detection", () => {
  it("picks the best supported language from Accept-Language", () => {
    expect(localeFromAcceptLanguage("ru-RU,ru;q=0.9,en;q=0.8")).toBe("ru")
    expect(localeFromAcceptLanguage("de-DE,en;q=0.5")).toBe("en")
    expect(localeFromAcceptLanguage("fr,de;q=0.9")).toBeNull()
    expect(localeFromAcceptLanguage(null)).toBeNull()
  })
})

describe("download names", () => {
  it("keeps HTTP headers ASCII and offers the UTF-8 name separately", () => {
    const header = csvResponse("x", "контакты-ș.csv").headers.get("content-disposition")!
    expect(header).toMatch(/^attachment; filename="[\x20-\x7e]+"; filename\*=UTF-8''/)
    expect(header).toContain(encodeURIComponent("контакты-ș.csv"))
  })
})
