import { useTranslations } from "next-intl"
import { getTranslations } from "next-intl/server"
import { Suspense } from "react"

import { PageHeader } from "@/components/shared/page-header"
import { PageSkeleton } from "@/components/shared/page-skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getOrgContext } from "@/lib/auth/session"
import { moduleMetadata } from "@/lib/i18n/metadata"
import { InvitationsTable } from "@/modules/team/components/invitations-table"
import { InviteDialog } from "@/modules/team/components/invite-dialog"
import { MembersTable } from "@/modules/team/components/members-table"
import { TeamsList } from "@/modules/team/components/teams-list"
import { listMembers, listPendingInvitations, listRoles, listTeams } from "@/modules/team/queries"

export const generateMetadata = moduleMetadata("team")

export default function TeamPage() {
  const t = useTranslations()

  return (
    <>
      <PageHeader title={t("nav.team")} description={t("modules.team")} />
      <Suspense fallback={<PageSkeleton />}>
        <TeamContent />
      </Suspense>
    </>
  )
}

async function TeamContent() {
  const t = await getTranslations("team")
  const ctx = await getOrgContext()
  const canManage = ctx.can("team.manage")

  const [members, roles, teams, invitations] = await Promise.all([
    listMembers(ctx.organizationId),
    listRoles(ctx.organizationId),
    listTeams(ctx.organizationId),
    canManage ? listPendingInvitations(ctx.organizationId) : Promise.resolve([]),
  ])

  const memberOptions = members
    .filter((m) => m.status === "active")
    .map((m) => ({ value: m.profile.id, label: m.profile.full_name || m.profile.email }))
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }))

  return (
    <Tabs defaultValue="members">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          <TabsTrigger value="members">{t("tabs.members", { count: members.length })}</TabsTrigger>
          {canManage && (
            <TabsTrigger value="invitations">
              {t("tabs.invitations", { count: invitations.length })}
            </TabsTrigger>
          )}
          <TabsTrigger value="teams">{t("tabs.teams", { count: teams.length })}</TabsTrigger>
        </TabsList>
        {canManage && (
          <InviteDialog
            roles={roleOptions}
            teams={teams.map((tm) => ({ value: tm.id, label: tm.name }))}
            defaultRoleId={roles.find((r) => r.key === "agent")?.id}
          />
        )}
      </div>
      <TabsContent value="members" className="mt-4">
        <MembersTable
          members={members}
          roles={roleOptions.map((r) => ({ id: r.value, name: r.label }))}
          canManage={canManage}
          currentUserId={ctx.user.id}
        />
      </TabsContent>
      {canManage && (
        <TabsContent value="invitations" className="mt-4">
          <InvitationsTable invitations={invitations} canManage={canManage} />
        </TabsContent>
      )}
      <TabsContent value="teams" className="mt-4">
        <TeamsList teams={teams} members={memberOptions} canManage={canManage} />
      </TabsContent>
    </Tabs>
  )
}
