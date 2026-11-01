import "server-only"

import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

import type { CrmOptions, CustomFieldDef, StageKind } from "./types"

export const getCrmOptions = cache(async (organizationId: string): Promise<CrmOptions> => {
  const supabase = await createClient()
  const [pipelines, sources, tags, reasons, members, teams, fields] = await Promise.all([
    supabase
      .from("pipelines")
      .select(
        "id, name, is_default, position, stages:pipeline_stages(id, name, color, kind, position)"
      )
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("position")
      .order("created_at"),
    supabase
      .from("lead_sources")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("position"),
    supabase
      .from("tags")
      .select("id, name, color")
      .eq("organization_id", organizationId)
      .order("name"),
    supabase
      .from("loss_reasons")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("position"),
    supabase
      .from("memberships")
      .select("profile:profiles!inner(id, full_name, email)")
      .eq("organization_id", organizationId)
      .eq("status", "active"),
    supabase.from("teams").select("id, name").eq("organization_id", organizationId).order("name"),
    supabase
      .from("custom_field_definitions")
      .select("id, entity, key, label, type, options, is_required")
      .eq("organization_id", organizationId)
      .order("position")
      .order("created_at"),
  ])

  for (const r of [pipelines, sources, tags, reasons, members, teams, fields]) {
    if (r.error) throw r.error
  }

  return {
    pipelines: pipelines.data!.map((p) => ({
      id: p.id,
      name: p.name,
      isDefault: p.is_default,
      stages: [...p.stages]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ ...s, kind: s.kind as StageKind })),
    })),
    sources: sources.data!,
    tags: tags.data!,
    lossReasons: reasons.data!,
    members: members
      .data!.map((m) => ({ id: m.profile.id, name: m.profile.full_name || m.profile.email }))
      .sort((a, b) => a.name.localeCompare(b.name, "ro")),
    teams: teams.data!,
    customFields: fields.data!.map((f): CustomFieldDef => ({
      id: f.id,
      entity: f.entity as CustomFieldDef["entity"],
      key: f.key,
      label: f.label,
      type: f.type as CustomFieldDef["type"],
      options: Array.isArray(f.options) ? f.options.map(String) : [],
      isRequired: f.is_required,
    })),
  }
})

/** Toate sursele, inclusiv cele dezactivate (pentru setări). */
export async function listAllSources(organizationId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("lead_sources")
    .select("id, name, channel, is_active")
    .eq("organization_id", organizationId)
    .order("position")
    .order("name")
  if (error) throw error
  return data
}

export type SourceRow = Awaited<ReturnType<typeof listAllSources>>[number]
