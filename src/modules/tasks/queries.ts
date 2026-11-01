import "server-only"

import { refColumn, type RecordRef } from "@/lib/crm/record-ref"
import { createClient } from "@/lib/supabase/server"

import type { TaskStatus } from "./schemas"

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
