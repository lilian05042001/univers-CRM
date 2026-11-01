import "server-only"

import { idsWithTag, searchFilter } from "@/lib/crm/records"
import { isUuid, pageRange, type ListParams } from "@/lib/list-params"
import { createClient } from "@/lib/supabase/server"
import type { StageKind, TagOption } from "@/modules/crm-config/types"

import { PRIORITIES, type LEAD_SORT_KEYS, type Priority } from "./schemas"

type SortKey = (typeof LEAD_SORT_KEYS)[number]

export type LeadRow = {
  id: string
  title: string
  stage: { id: string; name: string; color: string; kind: StageKind }
  value: number
  currency: string
  contactName: string | null
  companyName: string | null
  responsibleId: string | null
  priority: Priority
  nextTaskDueAt: string | null
  createdAt: string
  tags: TagOption[]
}

export async function listLeads(
  organizationId: string,
  userId: string,
  params: ListParams<SortKey>
) {
  const supabase = await createClient()
  let query = supabase
    .from("leads")
    .select(
      "id, title, value, currency, responsible_id, priority, next_task_due_at, created_at, stage:pipeline_stages!inner(id, name, color, kind), company:companies(name), contacts:lead_contacts(is_primary, contact:contacts(full_name)), tags:lead_tags(tag:tags(id, name, color))",
      { count: "exact" }
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  if (params.q) query = query.or(searchFilter(params.q))

  const pipeline = params.get("pipeline")
  if (isUuid(pipeline)) query = query.eq("pipeline_id", pipeline)
  const stage = params.get("stage")
  if (isUuid(stage)) query = query.eq("stage_id", stage)
  const status = params.get("status")
  if (status === "open" || status === "won" || status === "lost") query = query.eq("status", status)

  const responsible = params.get("responsible")
  if (responsible === "none") query = query.is("responsible_id", null)
  else if (responsible === "me") query = query.eq("responsible_id", userId)
  else if (isUuid(responsible)) query = query.eq("responsible_id", responsible)

  for (const [param, column] of [
    ["team", "team_id"],
    ["source", "source_id"],
    ["company", "company_id"],
  ] as const) {
    const value = params.get(param)
    if (isUuid(value)) query = query.eq(column, value)
  }

  const priority = params.get("priority")
  if ((PRIORITIES as readonly string[]).includes(priority))
    query = query.eq("priority", priority as Priority)

  const tag = params.get("tag")
  if (isUuid(tag)) {
    const ids = await idsWithTag("lead_tags", "lead_id", tag)
    if (ids.length === 0) return { rows: [] as LeadRow[], total: 0 }
    query = query.in("id", ids)
  }

  const { from, to } = pageRange(params)
  const { data, error, count } = await query
    .order(params.sort, { ascending: params.dir === "asc", nullsFirst: false })
    .order("id")
    .range(from, to)
  if (error) throw error

  const rows: LeadRow[] = data.map((l) => {
    const contact = l.contacts.find((c) => c.is_primary) ?? l.contacts[0]
    return {
      id: l.id,
      title: l.title,
      stage: { ...l.stage, kind: l.stage.kind as StageKind },
      value: Number(l.value),
      currency: l.currency,
      contactName: contact?.contact.full_name ?? null,
      companyName: l.company?.name ?? null,
      responsibleId: l.responsible_id,
      priority: l.priority,
      nextTaskDueAt: l.next_task_due_at,
      createdAt: l.created_at,
      tags: l.tags.map((t) => t.tag),
    }
  })
  return { rows, total: count ?? 0 }
}

export async function getLead(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, title, pipeline_id, stage_id, value, source_id, responsible_id, team_id, priority, description, loss_reason_id, loss_comment, custom_fields, company:companies(id, name), contacts:lead_contacts(is_primary, contact:contacts(id, full_name)), tags:lead_tags(tag_id)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw error
  return data
}

export type LeadRecord = NonNullable<Awaited<ReturnType<typeof getLead>>>
