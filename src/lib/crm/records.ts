import "server-only"

import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { containsPattern, normalizeSearch } from "@/lib/utils/search"

/** Selecția pentru acțiunile în masă. */
export const idsSchema = z.array(z.uuid()).min(1).max(500)

type TagTable = "lead_tags" | "contact_tags" | "company_tags" | "conversation_tags"
type TagColumn = "lead_id" | "contact_id" | "company_id" | "conversation_id"

/** Etichetele unei înregistrări devin exact `tagIds`. */
export async function syncTags(
  table: TagTable,
  column: TagColumn,
  organizationId: string,
  recordId: string,
  tagIds: string[]
) {
  const supabase = await createClient()
  const { error: delError } = await supabase
    .from(table)
    .delete()
    .eq(column as never, recordId as never)
  if (delError) throw delError
  if (tagIds.length === 0) return
  const rows = tagIds.map((tag_id) => ({
    organization_id: organizationId,
    [column]: recordId,
    tag_id,
  }))
  const { error } = await supabase.from(table).insert(rows as never)
  if (error) throw error
}

/** Adaugă o etichetă mai multor înregistrări (fără duplicate). */
export async function addTag(
  table: TagTable,
  column: TagColumn,
  organizationId: string,
  recordIds: string[],
  tagId: string
) {
  const supabase = await createClient()
  const rows = recordIds.map((id) => ({
    organization_id: organizationId,
    [column]: id,
    tag_id: tagId,
  }))
  const { error } = await supabase
    .from(table)
    .upsert(rows as never, { onConflict: `${column},tag_id`, ignoreDuplicates: true })
  if (error) throw error
}

/** Id-urile înregistrărilor care au eticheta dată (filtrul „Etichetă” din liste). */
export async function idsWithTag(
  table: TagTable,
  column: TagColumn,
  tagId: string
): Promise<string[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from(table)
    .select(column as never)
    .eq("tag_id", tagId)
    .limit(5000)
  if (error) throw error
  return (data as unknown as Record<string, string>[]).map((r) => r[column]!)
}

/** Valoare pentru filtrele `or=(...)` PostgREST, între ghilimele (virgule, paranteze sigure). */
function quoted(value: string) {
  return `"${value.replace(/["\\]/g, (c) => `\\${c}`)}"`
}

/** Condiția de căutare pe `search_text`, opțional extinsă cu id-uri găsite în alte tabele. */
export function searchFilter(q: string, extraIds: string[] = []): string {
  const pattern = quoted(containsPattern(normalizeSearch(q)))
  return extraIds.length
    ? `search_text.ilike.${pattern},id.in.(${extraIds.join(",")})`
    : `search_text.ilike.${pattern}`
}
