import { getOrgContext } from "@/lib/auth/session"

/**
 * Trimite la onboarding utilizatorii fără organizație, pe orice pagină din aplicație.
 * Nu depinde de componente care pot lipsi (ex. meniul lateral închis pe telefon).
 */
export async function OrganizationGuard() {
  await getOrgContext()
  return null
}
