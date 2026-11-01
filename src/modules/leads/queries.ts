import "server-only"

import { idsWithTag, searchFilter } from "@/lib/crm/records"
import { isUuid, pageRange, type ListParams } from "@/lib/list-params"
import { createClient } from "@/lib/supabase/server"
import type { StageKind, TagOption } from "@/modules/crm-config/types"

import { PRIORITIES, type LEAD_SORT_KEYS, type Priority } from "./schemas"

type SortKey = (typeof LEAD_SORT_KEYS)[number]
type Supabase = Awaited<ReturnType<typeof createClient>>

export type LeadRow = {
  id: string
  title: string
  stage: { id: string; name: string; color: string; kind: StageKind }
  value: number
  wonAmount: number | null
  currency: string
  contactName: string | null
  companyName: string | null
  responsibleId: string | null
  priority: Priority
  nextTaskDueAt: string | null
  createdAt: string
  tags: TagOption[]
}

/** Filtrele comune listei și tablei Kanban (din parametrii URL). */
export type LeadFilters = (key: string) => string

const LEAD_ROW_SELECT =
  "id, title, value, won_amount, currency, responsible_id, priority, next_task_due_at, created_at, stage:pipeline_stages!inner(id, name, color, kind), company:companies(name), contacts:lead_contacts(is_primary, contact:contacts(full_name)), tags:lead_tags(tag:tags(id, name, color))"

function leadsQuery(supabase: Supabase, organizationId: string) {
  return supabase
    .from("leads")
    .select(LEAD_ROW_SELECT, { count: "exact" })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
}

type LeadsQuery = ReturnType<typeof leadsQuery>

/**
 * Aplică filtrele; `null` dacă rezultatul e sigur gol (ex. eticheta nu are lead-uri).
 * Builder-ul e întors într-un obiect: fiind „thenable”, un `await` direct l-ar executa.
 */
async function applyFilters(
  query: LeadsQuery,
  get: LeadFilters,
  userId: string
): Promise<{ query: LeadsQuery } | null> {
  const q = get("q")
  if (q) query = query.or(searchFilter(q))

  const status = get("status")
  if (status === "open" || status === "won" || status === "lost") query = query.eq("status", status)

  const responsible = get("responsible")
  if (responsible === "none") query = query.is("responsible_id", null)
  else if (responsible === "me") query = query.eq("responsible_id", userId)
  else if (isUuid(responsible)) query = query.eq("responsible_id", responsible)

  for (const [param, column] of [
    ["pipeline", "pipeline_id"],
    ["stage", "stage_id"],
    ["team", "team_id"],
    ["source", "source_id"],
    ["company", "company_id"],
  ] as const) {
    const value = get(param)
    if (isUuid(value)) query = query.eq(column, value)
  }

  const priority = get("priority")
  if ((PRIORITIES as readonly string[]).includes(priority)) {
    query = query.eq("priority", priority as Priority)
  }

  const tag = get("tag")
  if (isUuid(tag)) {
    const ids = await idsWithTag("lead_tags", "lead_id", tag)
    if (ids.length === 0) return null
    query = query.in("id", ids)
  }
  return { query }
}

type LeadRowData = NonNullable<Awaited<LeadsQuery>["data"]>[number]

function toLeadRow(l: LeadRowData): LeadRow {
  const contact = l.contacts.find((c) => c.is_primary) ?? l.contacts[0]
  return {
    id: l.id,
    title: l.title,
    stage: { ...l.stage, kind: l.stage.kind as StageKind },
    value: Number(l.value),
    wonAmount: l.won_amount === null ? null : Number(l.won_amount),
    currency: l.currency,
    contactName: contact?.contact.full_name ?? null,
    companyName: l.company?.name ?? null,
    responsibleId: l.responsible_id,
    priority: l.priority,
    nextTaskDueAt: l.next_task_due_at,
    createdAt: l.created_at,
    tags: l.tags.map((t) => t.tag),
  }
}

export async function listLeads(
  organizationId: string,
  userId: string,
  params: ListParams<SortKey>
) {
  const supabase = await createClient()
  const filtered = await applyFilters(leadsQuery(supabase, organizationId), params.get, userId)
  if (!filtered) return { rows: [] as LeadRow[], total: 0 }

  const { from, to } = pageRange(params)
  const { data, error, count } = await filtered.query
    .order(params.sort, { ascending: params.dir === "asc", nullsFirst: false })
    .order("id")
    .range(from, to)
  if (error) throw error
  return { rows: data.map(toLeadRow), total: count ?? 0 }
}

export const BOARD_PAGE_SIZE = 30

/** Cardurile unei coloane Kanban, în ordinea din tablă. */
export async function listStageLeads(
  organizationId: string,
  userId: string,
  stageId: string,
  get: LeadFilters,
  offset = 0
) {
  const supabase = await createClient()
  const filtered = await applyFilters(
    leadsQuery(supabase, organizationId).eq("stage_id", stageId),
    get,
    userId
  )
  if (!filtered) return [] as LeadRow[]

  const { data, error } = await filtered.query
    .order("position")
    .order("created_at", { ascending: false })
    .range(offset, offset + BOARD_PAGE_SIZE - 1)
  if (error) throw error
  return data.map(toLeadRow)
}

/** Numărul și suma lead-urilor pe etape (aceleași filtre de bază ca tabla). */
export async function getPipelineSummary(pipelineId: string, get: LeadFilters) {
  const supabase = await createClient()
  const priority = get("priority")
  const { data, error } = await supabase.rpc("pipeline_summary", {
    p_pipeline: pipelineId,
    p_search: get("q") || undefined,
    p_responsible: get("responsible") || undefined,
    p_priority: (PRIORITIES as readonly string[]).includes(priority)
      ? (priority as Priority)
      : undefined,
  })
  if (error) throw error
  return Object.fromEntries(
    data.map((s) => [s.stage_id, { count: Number(s.lead_count), total: Number(s.total) }])
  )
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

/** Fișa lead-ului: datele comerciale, clientul (contacte + companie), etichetele. */
export async function getLeadDetail(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, title, status, pipeline_id, value, won_amount, currency, priority, description, custom_fields, created_at, last_activity_at, next_task_due_at, closed_at, loss_comment, responsible_id, stage:pipeline_stages!inner(id, name, color, kind), company:companies(id, name, phone, email), source:lead_sources(name), loss_reason:loss_reasons(name), team:teams(name), contacts:lead_contacts(is_primary, contact:contacts(id, full_name, position, identities:contact_identities(type, value, is_primary))), tags:lead_tags(tag:tags(id, name, color))"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()
  if (error) throw error
  return data
}

export type LeadDetail = NonNullable<Awaited<ReturnType<typeof getLeadDetail>>>
