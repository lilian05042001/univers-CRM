import { useTranslations } from "next-intl"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { moduleMetadata } from "@/lib/i18n/metadata"
import { parseListParams } from "@/lib/list-params"
import { getCrmOptions } from "@/modules/crm-config/queries"
import { TasksView } from "@/modules/tasks/components/tasks-view"
import { countOpenTasks, listTaskTypes, listTasks } from "@/modules/tasks/queries"
import { TASK_VIEWS, type TaskView } from "@/modules/tasks/schemas"

export const generateMetadata = moduleMetadata("tasks")

export default function TasksPage({ searchParams }: PageProps<"/[locale]/tasks">) {
  const t = useTranslations()

  return (
    <>
      <PageHeader title={t("nav.tasks")} description={t("modules.tasks")} />
      <Suspense fallback={<PageSkeleton />}>
        <Tasks searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Tasks({ searchParams }: Pick<PageProps<"/[locale]/tasks">, "searchParams">) {
  const params = parseListParams(await searchParams, {
    sortKeys: ["due_at"] as const,
    defaultSort: "due_at",
  })
  const ctx = await getOrgContext()
  const timeZone = ctx.membership.organization.timezone
  const viewParam = params.get("view")
  const view: TaskView = (TASK_VIEWS as readonly string[]).includes(viewParam)
    ? (viewParam as TaskView)
    : "today"
  // Implicit: sarcinile proprii; „everyone” = toate sarcinile vizibile.
  const responsibleParam = params.get("responsible") || "me"
  const responsible = responsibleParam === "everyone" ? "" : responsibleParam

  const [{ rows, total }, counts, types, options] = await Promise.all([
    listTasks(ctx.organizationId, ctx.user.id, {
      view,
      responsible,
      typeId: params.get("type"),
      timeZone,
      page: params.page,
      pageSize: params.pageSize,
    }),
    countOpenTasks(ctx.organizationId, ctx.user.id, responsible, timeZone),
    listTaskTypes(ctx.organizationId),
    getCrmOptions(ctx.organizationId),
  ])

  return (
    <TasksView
      rows={rows}
      total={total}
      page={params.page}
      pageSize={params.pageSize}
      view={view}
      counts={counts}
      context={{ types, members: options.members, currentUserId: ctx.user.id, timeZone }}
    />
  )
}
