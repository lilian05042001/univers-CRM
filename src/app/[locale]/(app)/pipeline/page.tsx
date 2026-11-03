import { KanbanSquare } from "lucide-react"
import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { moduleMetadata } from "@/lib/i18n/metadata"
import { hashKey } from "@/lib/utils/hash"
import { isUuid, parseListParams } from "@/lib/list-params"
import { getCrmOptions } from "@/modules/crm-config/queries"
import { getLead, getPipelineSummary, listStageLeads } from "@/modules/leads/queries"
import { BoardView } from "@/modules/pipeline/components/board-view"

export const generateMetadata = moduleMetadata("pipeline")

export default function PipelinePage({ searchParams }: PageProps<"/[locale]/pipeline">) {
  const t = useTranslations()

  return (
    <>
      <PageHeader title={t("nav.pipeline")} description={t("modules.pipeline")} />
      <Suspense fallback={<PageSkeleton rows={3} />}>
        <Board searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Board({ searchParams }: Pick<PageProps<"/[locale]/pipeline">, "searchParams">) {
  const params = parseListParams(await searchParams, {
    sortKeys: ["position"] as const,
    defaultSort: "position",
  })
  const ctx = await getOrgContext()
  const options = await getCrmOptions(ctx.organizationId)
  const requested = params.get("pipeline")
  const pipeline =
    options.pipelines.find((p) => p.id === requested) ??
    options.pipelines.find((p) => p.isDefault) ??
    options.pipelines[0]

  if (!pipeline) {
    const t = await getTranslations("pipeline")
    return (
      <EmptyState
        icon={KanbanSquare}
        title={t("noPipelineTitle")}
        description={t("noPipelineDescription")}
      />
    )
  }

  const filters = {
    q: params.q,
    responsible: params.get("responsible"),
    priority: params.get("priority"),
    tag: params.get("tag"),
  }
  const get = (key: string) => (filters as Record<string, string>)[key] ?? ""
  const open = params.get("open")

  const [summary, stageLeads, record] = await Promise.all([
    getPipelineSummary(pipeline.id, get),
    Promise.all(
      pipeline.stages.map((s) => listStageLeads(ctx.organizationId, ctx.user.id, s.id, get))
    ),
    isUuid(open) ? getLead(open) : Promise.resolve(null),
  ])

  // Tabla ține cardurile în stare locală (mutări optimiste); cheia derivată din date o
  // re-creează când serverul aduce date noi (Next păstrează starea paginilor vizitate).
  const dataKey = hashKey(
    JSON.stringify([
      summary,
      stageLeads.map((leads) =>
        leads.map((l) => [
          l.id,
          l.stage.id,
          l.title,
          l.value,
          l.responsibleId,
          l.nextTaskDueAt,
          l.tags.length,
        ])
      ),
    ])
  )

  return (
    <BoardView
      key={dataKey}
      pipelineId={pipeline.id}
      columns={Object.fromEntries(pipeline.stages.map((s, i) => [s.id, stageLeads[i]!]))}
      summary={summary}
      filters={filters}
      options={options}
      currency={ctx.membership.organization.currency}
      record={record}
      isNew={open === "new"}
      userId={ctx.user.id}
      can={{
        create: ctx.can("leads.create"),
        edit: ctx.can("leads.edit"),
        assign: ctx.can("leads.assign"),
      }}
    />
  )
}
