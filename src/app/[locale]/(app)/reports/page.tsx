import { useTranslations } from "next-intl"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { moduleMetadata } from "@/lib/i18n/metadata"
import { ReportScreen } from "@/modules/reports/components/report-screen"

export const generateMetadata = moduleMetadata("reports")

/** Primul raport (lead-uri) e pagina implicită a modulului. */
export default function ReportsPage({ searchParams }: PageProps<"/[locale]/reports">) {
  const t = useTranslations()

  return (
    <>
      <PageHeader title={t("nav.reports")} description={t("modules.reports")} />
      <Suspense fallback={<PageSkeleton />}>
        <Report searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Report({ searchParams }: Pick<PageProps<"/[locale]/reports">, "searchParams">) {
  return <ReportScreen reportKey="leads" searchParams={await searchParams} />
}
