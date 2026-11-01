import "server-only"

import { refColumn, type RecordRef } from "@/lib/crm/record-ref"
import type { Json } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

export type ActivityItem = {
  id: number
  type: string
  actorId: string | null
  payload: Record<string, Json | undefined>
  occurredAt: string
  leadId: string | null
}

/** Cronologia unei înregistrări, cele mai noi primele. */
export async function listActivities(ref: RecordRef, limit = 100): Promise<ActivityItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("activities")
    .select("id, type, actor_id, payload, occurred_at, lead_id")
    .eq(refColumn(ref.entity), ref.id)
    .order("occurred_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit)
  if (error) throw error
  return data.map((a) => ({
    id: a.id,
    type: a.type,
    actorId: a.actor_id,
    payload: (a.payload ?? {}) as Record<string, Json | undefined>,
    occurredAt: a.occurred_at,
    leadId: a.lead_id,
  }))
}

export type NoteItem = {
  id: string
  body: string
  isPinned: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export async function listNotes(ref: RecordRef): Promise<NoteItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("notes")
    .select("id, body, is_pinned, created_by, created_at, updated_at")
    .eq(refColumn(ref.entity), ref.id)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) throw error
  return data.map((n) => ({
    id: n.id,
    body: n.body,
    isPinned: n.is_pinned,
    createdBy: n.created_by,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  }))
}

export type FileItem = {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  createdBy: string | null
  createdAt: string
}

export async function listFiles(ref: RecordRef): Promise<FileItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("files")
    .select("id, file_name, mime_type, size_bytes, created_by, created_at")
    .eq(refColumn(ref.entity), ref.id)
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) throw error
  return data.map((f) => ({
    id: f.id,
    fileName: f.file_name,
    mimeType: f.mime_type,
    sizeBytes: Number(f.size_bytes),
    createdBy: f.created_by,
    createdAt: f.created_at,
  }))
}
