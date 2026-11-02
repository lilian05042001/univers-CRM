import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { ReportScreen } from "@/modules/reports/components/report-screen"
import { REPORT_KEYS, type ReportKey } from "@/modules/reports/types"

export async function generateMetadata({
  params,
}: PageProps<"/reports/[report]">): Promise<Metadata> {
  const { report } = await params
  const t = await getTranslations("reports.list")
  return {
    title: (REPORT_KEYS as readonly string[]).includes(report)
      ? t(`${report as ReportKey}.title`)
      : undefined,
  }
}

export default function ReportPage({ params, searchParams }: PageProps<"/reports/[report]">) {
  const t = useTranslations()

  return (
    <>
      <PageHeader title={t("nav.reports")} description={t("modules.reports")} />
      <Suspense fallback={<PageSkeleton />}>
        <Report params={params} searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Report({ params, searchParams }: PageProps<"/reports/[report]">) {
  const [{ report }, query] = await Promise.all([params, searchParams])
  if (!(REPORT_KEYS as readonly string[]).includes(report)) notFound()
  return <ReportScreen reportKey={report as ReportKey} searchParams={query} />
}
