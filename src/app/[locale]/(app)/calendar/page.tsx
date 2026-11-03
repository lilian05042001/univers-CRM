import { useTranslations } from "next-intl"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { getOrgContext } from "@/lib/auth/session"
import { moduleMetadata } from "@/lib/i18n/metadata"
import { zonedRange, zonedToday } from "@/lib/utils/timezone"
import { CalendarView } from "@/modules/calendar/components/calendar-view"
import { CALENDAR_VIEWS, visibleRange, type CalendarView as View } from "@/modules/calendar/utils"
import { getCrmOptions } from "@/modules/crm-config/queries"
import { listTaskTypes, listTasksInRange } from "@/modules/tasks/queries"

export const generateMetadata = moduleMetadata("calendar")

export default function CalendarPage({ searchParams }: PageProps<"/[locale]/calendar">) {
  const t = useTranslations()

  return (
    <>
      <PageHeader title={t("nav.calendar")} description={t("modules.calendar")} />
      <Suspense fallback={<PageSkeleton rows={6} />}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Calendar({ searchParams }: Pick<PageProps<"/[locale]/calendar">, "searchParams">) {
  const sp = await searchParams
  const ctx = await getOrgContext()
  const timeZone = ctx.membership.organization.timezone
  const today = zonedToday(timeZone)
  const view: View = (CALENDAR_VIEWS as readonly string[]).includes(String(sp.view))
    ? (sp.view as View)
    : "month"
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today
  const responsibleParam = typeof sp.responsible === "string" ? sp.responsible : "me"
  const responsible = responsibleParam === "everyone" ? "" : responsibleParam

  const { from, days } = visibleRange(view, date)
  const [tasks, types, options] = await Promise.all([
    listTasksInRange(
      ctx.organizationId,
      ctx.user.id,
      zonedRange(from, days, timeZone),
      responsible
    ),
    listTaskTypes(ctx.organizationId),
    getCrmOptions(ctx.organizationId),
  ])

  return (
    <CalendarView
      view={view}
      date={date}
      from={from}
      days={days}
      today={today}
      tasks={tasks}
      context={{ types, members: options.members, currentUserId: ctx.user.id, timeZone }}
    />
  )
}
