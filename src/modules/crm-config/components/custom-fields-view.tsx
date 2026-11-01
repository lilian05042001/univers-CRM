"use client"

import { useFormatter, useTranslations } from "next-intl"

import { DetailList } from "@/components/shared/detail-list"

import type { CustomFieldDef } from "../types"

/** Afișarea valorilor câmpurilor personalizate într-o fișă. */
export function CustomFieldsView({ defs, values }: { defs: CustomFieldDef[]; values: unknown }) {
  const t = useTranslations("common")
  const format = useFormatter()
  const source = (values && typeof values === "object" ? values : {}) as Record<string, unknown>

  const items = defs.map((def) => {
    const v = source[def.key]
    let value: React.ReactNode = null
    if (v === undefined || v === null || v === "") value = null
    else if (def.type === "bool") value = v === true ? t("yes") : t("no")
    else if (def.type === "multiselect" && Array.isArray(v)) value = v.join(", ")
    else if (def.type === "number") value = format.number(Number(v))
    else if (def.type === "date")
      value = format.dateTime(new Date(String(v)), { dateStyle: "medium" })
    else if (def.type === "url")
      value = (
        <a
          href={String(v)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {String(v)}
        </a>
      )
    else value = String(v)
    return { label: def.label, value }
  })

  return <DetailList items={items} />
}
