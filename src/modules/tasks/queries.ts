import "server-only"

import { refColumn, type RecordRef } from "@/lib/crm/record-ref"
import { isUuid } from "@/lib/list-params"
import { zonedRange, zonedToday } from "@/lib/utils/timezone"
import { createClient } from "@/lib/supabase/server"

import type { TaskStatus, TaskView } from "./schemas"

export type TaskItem = {
  id: string
  title: string
  description: string | null
  typeId: string
  typeKey: string
  typeName: string
  status: TaskStatus
  priority: "low" | "normal" | "high" | "urgent"
  dueAt: string
  durationMinutes: number | null
  responsibleId: string | null
  completedAt: string | null
  result: string | null
  lead: { id: string; title: string } | null
  contact: { id: string; name: string } | null
}

export const TASK_SELECT =
  "id, title, description, type_id, status, priority, due_at, duration_minutes, responsible_id, completed_at, result, type:task_types!inner(key, name), lead:leads(id, title), contact:contacts(id, full_name)"

type TaskRowData = {
  id: string
  title: string
  description: string | null
  type_id: string
  status: TaskStatus
  priority: TaskItem["priority"]
  due_at: string
  duration_minutes: number | null
  responsible_id: string | null
  completed_at: string | null
  result: string | null
  type: { key: string; name: string }
  lead: { id: string; title: string } | null
  contact: { id: string; full_name: string | null } | null
}

export function toTaskItem(t: TaskRowData): TaskItem {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    typeId: t.type_id,
    typeKey: t.type.key,
    typeName: t.type.name,
    status: t.status,
    priority: t.priority,
    dueAt: t.due_at,
    durationMinutes: t.duration_minutes,
    responsibleId: t.responsible_id,
    completedAt: t.completed_at,
    result: t.result,
    lead: t.lead,
    contact: t.contact ? { id: t.contact.id, name: t.contact.full_name ?? "" } : null,
  }
}

/** Sarcinile unei înregistrări: deschise (după termen), apoi cele închise recent. */
export async function listTasksFor(ref: RecordRef): Promise<TaskItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq(refColumn(ref.entity), ref.id)
    .order("due_at")
    .limit(200)
  if (error) throw error
  const items = data.map(toTaskItem)
  const open = items.filter((t) => t.status === "new" || t.status === "in_progress")
  const closed = items
    .filter((t) => t.status === "done" || t.status === "cancelled")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
  return [...open, ...closed]
}

export async function listTaskTypes(organizationId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("task_types")
    .select("id, key, name, icon")
    .eq("organization_id", organizationId)
    .order("position")
  if (error) throw error
  return data
}

export type TaskTypeOption = Awaited<ReturnType<typeof listTaskTypes>>[number]

/** Lista de sarcini (pagina Sarcini): vedere + responsabil + tip, paginată. */
export async function listTasks(
  organizationId: string,
  userId: string,
  options: {
    view: TaskView
    responsible: string
    typeId: string
    timeZone: string
    page: number
    pageSize: number
  }
) {
  const supabase = await createClient()
  const now = new Date()
  const today = zonedRange(zonedToday(options.timeZone, now), 1, options.timeZone)

  let query = supabase
    .from("tasks")
    .select(TASK_SELECT, { count: "exact" })
    .eq("organization_id", organizationId)

  if (options.view === "done") query = query.in("status", ["done", "cancelled"])
  else if (options.view !== "all") query = query.in("status", ["new", "in_progress"])

  if (options.view === "today") {
    query = query.gte("due_at", today.start.toISOString()).lt("due_at", today.end.toISOString())
  } else if (options.view === "overdue") {
    query = query.lt("due_at", now.toISOString())
  } else if (options.view === "upcoming") {
    query = query.gte("due_at", today.end.toISOString())
  }

  if (options.responsible === "me") query = query.eq("responsible_id", userId)
  else if (options.responsible === "none") query = query.is("responsible_id", null)
  else if (isUuid(options.responsible)) query = query.eq("responsible_id", options.responsible)
  if (isUuid(options.typeId)) query = query.eq("type_id", options.typeId)

  const from = (options.page - 1) * options.pageSize
  const { data, error, count } = await query
    .order(options.view === "done" ? "completed_at" : "due_at", {
      ascending: options.view !== "done",
    })
    .range(from, from + options.pageSize - 1)
  if (error) throw error
  return { rows: data.map(toTaskItem), total: count ?? 0 }
}

/** Sarcinile din intervalul calendarului (fără cele anulate). */
export async function listTasksInRange(
  organizationId: string,
  userId: string,
  range: { start: Date; end: Date },
  responsible: string
) {
  const supabase = await createClient()
  let query = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("organization_id", organizationId)
    .neq("status", "cancelled")
    .gte("due_at", range.start.toISOString())
    .lt("due_at", range.end.toISOString())
  if (responsible === "me") query = query.eq("responsible_id", userId)
  else if (isUuid(responsible)) query = query.eq("responsible_id", responsible)
  const { data, error } = await query.order("due_at").limit(1000)
  if (error) throw error
  return data.map(toTaskItem)
}

/** Numărul de sarcini deschise pe vederi (pentru tab-uri), cu același filtru de responsabil. */
export async function countOpenTasks(
  organizationId: string,
  userId: string,
  responsible: string,
  timeZone: string
) {
  const supabase = await createClient()
  const now = new Date()
  const today = zonedRange(zonedToday(timeZone, now), 1, timeZone)

  const base = () => {
    let q = supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("status", ["new", "in_progress"])
    if (responsible === "me") q = q.eq("responsible_id", userId)
    else if (responsible === "none") q = q.is("responsible_id", null)
    else if (isUuid(responsible)) q = q.eq("responsible_id", responsible)
    return q
  }

  const [todayCount, overdue, upcoming] = await Promise.all([
    base().gte("due_at", today.start.toISOString()).lt("due_at", today.end.toISOString()),
    base().lt("due_at", now.toISOString()),
    base().gte("due_at", today.end.toISOString()),
  ])
  for (const r of [todayCount, overdue, upcoming]) if (r.error) throw r.error
  return {
    today: todayCount.count ?? 0,
    overdue: overdue.count ?? 0,
    upcoming: upcoming.count ?? 0,
  }
}
