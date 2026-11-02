import "server-only"

import { createClient } from "@/lib/supabase/server"

import type { ImportEntity } from "./fields"
import type { ImportError } from "./rows"

/** Un job „processing” fără progres de atâta timp a fost întrerupt (pagina închisă în timpul importului). */
const STALE_MS = 10 * 60 * 1000

export type ImportJobStatus = "processing" | "done" | "failed" | "cancelled" | "interrupted"

export type ImportJobRow = {
  id: string
  entity: ImportEntity
  status: ImportJobStatus
  fileName: string
  totalRows: number
  processedRows: number
  okCount: number
  skippedCount: number
  failedCount: number
  hasErrors: boolean
  author: string | null
  createdAt: string
}

/** Ultimele importuri vizibile (ale mele; toate pentru settings.manage — RLS). */
export async function listImportJobs(organizationId: string): Promise<ImportJobRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("import_jobs")
    .select(
      "id, entity, status, file_name, total_rows, processed_rows, ok_count, skipped_count, failed_count, errors, created_at, updated_at, author:profiles(full_name, email)"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) throw error

  const now = Date.now()
  return data.map((j) => ({
    id: j.id,
    entity: j.entity as ImportEntity,
    status:
      j.status === "processing" && now - new Date(j.updated_at).getTime() > STALE_MS
        ? "interrupted"
        : (j.status as ImportJobStatus),
    fileName: j.file_name,
    totalRows: j.total_rows,
    processedRows: j.processed_rows,
    okCount: j.ok_count,
    skippedCount: j.skipped_count,
    failedCount: j.failed_count,
    hasErrors: Array.isArray(j.errors) && j.errors.length > 0,
    author: j.author ? j.author.full_name || j.author.email : null,
    createdAt: j.created_at,
  }))
}

export async function getImportJobErrors(organizationId: string, id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("import_jobs")
    .select("entity, file_name, errors")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    entity: data.entity as ImportEntity,
    fileName: data.file_name,
    errors: (Array.isArray(data.errors) ? data.errors : []) as unknown as ImportError[],
  }
}
