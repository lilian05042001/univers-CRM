"use server"

import { z } from "zod"

import { createOrgAction } from "@/lib/actions/action"
import { ok } from "@/lib/actions/result"
import { searchFilter } from "@/lib/crm/records"
import { createClient } from "@/lib/supabase/server"
import { containsPattern, normalizeSearch } from "@/lib/utils/search"

export type SearchHit = { id: string; label: string; description?: string }
export type SearchResults = { leads: SearchHit[]; contacts: SearchHit[]; companies: SearchHit[] }

const LIMIT = 5

/** Căutarea globală (Ctrl+K): primele rezultate din lead-uri, contacte și companii vizibile. */
export const globalSearch = createOrgAction(
  { schema: z.object({ q: z.string().trim().min(2).max(100) }) },
  async ({ q }, ctx) => {
    const supabase = await createClient()
    const org = ctx.organizationId
    const term = /\d{3,}/.test(q) ? q.replace(/[^\d+]/g, "") : normalizeSearch(q)

    const identityMatches = await supabase
      .from("contact_identities")
      .select("contact_id")
      .eq("organization_id", org)
      .ilike("value_normalized", containsPattern(term))
      .limit(20)
    if (identityMatches.error) throw identityMatches.error
    const contactIds = [...new Set(identityMatches.data.map((r) => r.contact_id))]

    const [leads, contacts, companies] = await Promise.all([
      supabase
        .from("leads")
        .select("id, title, company:companies(name)")
        .eq("organization_id", org)
        .is("deleted_at", null)
        .or(searchFilter(q))
        .order("last_activity_at", { ascending: false })
        .limit(LIMIT),
      supabase
        .from("contacts")
        .select("id, full_name, company:companies(name)")
        .eq("organization_id", org)
        .is("deleted_at", null)
        .or(searchFilter(q, contactIds))
        .limit(LIMIT),
      supabase
        .from("companies")
        .select("id, name, industry")
        .eq("organization_id", org)
        .is("deleted_at", null)
        .or(searchFilter(q))
        .limit(LIMIT),
    ])
    for (const r of [leads, contacts, companies]) if (r.error) throw r.error

    return ok<SearchResults>({
      leads: leads.data!.map((l) => ({ id: l.id, label: l.title, description: l.company?.name })),
      contacts: contacts.data!.map((c) => ({
        id: c.id,
        label: c.full_name ?? "",
        description: c.company?.name,
      })),
      companies: companies.data!.map((c) => ({
        id: c.id,
        label: c.name,
        description: c.industry ?? undefined,
      })),
    })
  }
)
