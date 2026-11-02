import type { Metadata } from "next"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { isUuid, parseListParams } from "@/lib/list-params"
import { canReadAutomations } from "@/modules/automations/access"
import { NoAccess } from "@/modules/automations/components/no-access"
import { RunsView } from "@/modules/automations/components/runs-view"
import { listAutomations, listRuns } from "@/modules/automations/queries"
import { RUN_STATUSES } from "@/modules/automations/schemas"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("automations.runs")
  return { title: t("title") }
}

export default function RunsPage({ searchParams }: PageProps<"/automations/runs">) {
  const t = useTranslations("automations.runs")

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<PageSkeleton />}>
        <Runs searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Runs({ searchParams }: Pick<PageProps<"/automations/runs">, "searchParams">) {
  const params = parseListParams(await searchParams, {
    sortKeys: ["started_at"] as const,
    defaultSort: "started_at",
  })
  const ctx = await getOrgContext()
  if (!canReadAutomations(ctx)) return <NoAccess />
  const automationId = params.get("automation")
  const status = params.get("status")
  const [{ rows, total }, automations] = await Promise.all([
    listRuns(ctx.organizationId, {
      automationId: isUuid(automationId) ? automationId : "",
      status: (RUN_STATUSES as readonly string[]).includes(status) ? status : "",
      page: params.page,
      pageSize: params.pageSize,
    }),
    listAutomations(ctx.organizationId),
  ])
  return (
    <RunsView
      rows={rows}
      total={total}
      page={params.page}
      pageSize={params.pageSize}
      automations={automations.map((a) => ({ id: a.id, name: a.name }))}
    />
  )
}
