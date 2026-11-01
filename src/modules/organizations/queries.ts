import "server-only"

import { createClient } from "@/lib/supabase/server"

export async function getOrganization(organizationId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, legal_name, fiscal_code, country, currency, timezone, default_locale")
    .eq("id", organizationId)
    .single()
  if (error) throw error
  return data
}
