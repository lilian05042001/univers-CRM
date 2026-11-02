import { getTranslations } from "next-intl/server"

import { getOrgContext } from "@/lib/auth/session"
import { csvResponse, toCsvDocument } from "@/lib/csv"
import { isUuid } from "@/lib/list-params"
import { getCrmOptions } from "@/modules/crm-config/queries"
import { CUSTOM_PREFIX } from "@/modules/import-export/fields"
import { getImportJobErrors } from "@/modules/import-export/queries"

/** Raportul de erori al unui import (CSV: rând, câmp, eroare). */
export async function GET(
  _request: Request,
  route: RouteContext<"/settings/import-export/[id]/errors">
) {
  const { id } = await route.params
  const ctx = await getOrgContext()
  if (!ctx.can("data.import") || !isUuid(id)) return new Response("Not found", { status: 404 })
  const job = await getImportJobErrors(ctx.organizationId, id)
  if (!job) return new Response("Not found", { status: 404 })

  const t = await getTranslations()
  const defs = (await getCrmOptions(ctx.organizationId)).customFields
  const fieldLabel = (field: string | undefined) => {
    if (!field) return ""
    if (field.startsWith(CUSTOM_PREFIX))
      return defs.find((d) => `${CUSTOM_PREFIX}${d.key}` === field)?.label ?? field
    if (job.entity === "companies" && field === "name") return t("importExport.fields.companyName")
    return t(`importExport.fields.${field}`)
  }
  const message = (code: string) =>
    code.startsWith("validation.") ? t(code) : t(`importExport.errors.${code}`)

  const csv = toCsvDocument(
    [t("importExport.report.row"), t("importExport.report.field"), t("importExport.report.error")],
    job.errors.map((e) => [e.row, fieldLabel(e.field), message(e.code)])
  )
  return csvResponse(
    csv,
    `${t("importExport.report.fileName")}-${job.fileName.replace(/\.csv$/i, "")}.csv`
  )
}
