import { getOrgContext } from "@/lib/auth/session"
import { OrgSwitcher } from "@/modules/organizations/components/org-switcher"

/** Server wrapper: citește organizațiile utilizatorului (redirect la onboarding dacă nu are). */
export async function OrgSwitcherSlot() {
  const ctx = await getOrgContext()

  return (
    <OrgSwitcher
      activeId={ctx.organizationId}
      organizations={ctx.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        roleName: m.role.name,
      }))}
    />
  )
}
