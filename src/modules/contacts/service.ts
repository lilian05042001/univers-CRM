import "server-only"

import { createClient } from "@/lib/supabase/server"
import { normalizePhone } from "@/lib/utils/phone"

function clean(values: string[], normalize: (v: string) => string) {
  return [
    ...new Set(
      values
        .map((v) => v.trim())
        .filter(Boolean)
        .map(normalize)
    ),
  ]
}

/** Telefoanele și e-mailurile contactului devin exact listele date; primul e cel principal. */
export async function writeContactIdentities(
  organizationId: string,
  contactId: string,
  phones: string[],
  emails: string[]
) {
  const supabase = await createClient()
  const { error: delError } = await supabase
    .from("contact_identities")
    .delete()
    .eq("contact_id", contactId)
    .in("type", ["phone", "email"])
  if (delError) throw delError

  const rows = [
    ...clean(phones, (v) => normalizePhone(v)).map((value, i) => ({
      type: "phone",
      value,
      is_primary: i === 0,
    })),
    ...clean(emails, (v) => v.toLowerCase()).map((value, i) => ({
      type: "email",
      value,
      is_primary: i === 0,
    })),
  ].map((r) => ({ ...r, organization_id: organizationId, contact_id: contactId }))

  if (rows.length) {
    const { error } = await supabase.from("contact_identities").insert(rows)
    if (error) throw error
  }
}
