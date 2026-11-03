import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getOrgContext } from "@/lib/auth/session"
import { getCrmOptions } from "@/modules/crm-config/queries"
import { ExportPanel } from "@/modules/import-export/components/export-panel"
import { ImportHistory } from "@/modules/import-export/components/import-history"
import { ImportWizard } from "@/modules/import-export/components/import-wizard"
import { listImportJobs } from "@/modules/import-export/queries"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings.sections.importExport")
  return { title: t("title") }
}

export default function ImportExportPage() {
  const t = useTranslations("settings.sections.importExport")

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<PageSkeleton rows={6} />}>
        <Content />
      </Suspense>
    </>
  )
}

async function Content() {
  const ctx = await getOrgContext()
  const t = await getTranslations("importExport")
  const canImport = ctx.can("data.import") && ctx.can("contacts.create")
  const canExport = ctx.can("data.export")
  const [options, jobs] = await Promise.all([
    getCrmOptions(ctx.organizationId),
    canImport ? listImportJobs(ctx.organizationId) : Promise.resolve([]),
  ])

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      {!canImport && !canExport && <p className="text-sm text-muted-foreground">{t("noAccess")}</p>}
      {canImport && (
        <Card>
          <CardHeader>
            <CardTitle>{t("importTitle")}</CardTitle>
            <CardDescription>{t("importDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ImportWizard
              members={options.members}
              customFields={options.customFields}
              currentUserId={ctx.user.id}
            />
          </CardContent>
        </Card>
      )}
      {canExport && (
        <Card>
          <CardHeader>
            <CardTitle>{t("exportTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ExportPanel />
          </CardContent>
        </Card>
      )}
      {canImport && (
        <Card>
          <CardHeader>
            <CardTitle>{t("history.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ImportHistory jobs={jobs} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
