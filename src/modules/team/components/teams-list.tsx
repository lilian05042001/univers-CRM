"use client"

import { Pencil, Plus, Trash2, UsersRound } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import type { SelectOption } from "@/components/shared/form/select-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useActionRunner } from "@/lib/actions/use-action-runner"

import { deleteTeam } from "../actions"
import type { Team } from "../queries"

import { TeamDialog } from "./team-dialog"

export function TeamsList({
  teams,
  members,
  canManage,
}: {
  teams: Team[]
  members: SelectOption[]
  canManage: boolean
}) {
  const t = useTranslations("team.teams")
  const { run, pending } = useActionRunner()
  const nameOf = (id: string | null) => members.find((m) => m.value === id)?.label

  const createButton = canManage && (
    <TeamDialog
      members={members}
      trigger={
        <Button>
          <Plus />
          {t("create")}
        </Button>
      }
    />
  )

  if (teams.length === 0) {
    return (
      <EmptyState
        icon={UsersRound}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={createButton}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {createButton && <div className="flex justify-end">{createButton}</div>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => (
          <Card key={team.id}>
            <CardHeader>
              <CardTitle>{team.name}</CardTitle>
              <CardDescription>
                {t("managerLabel")}: {nameOf(team.manager_id) ?? "—"}
              </CardDescription>
              {canManage && (
                <CardAction className="flex gap-1">
                  <TeamDialog
                    team={team}
                    members={members}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={t("edit")}>
                        <Pencil />
                      </Button>
                    }
                  />
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("delete")}
                        disabled={pending}
                      >
                        <Trash2 />
                      </Button>
                    }
                    title={t("deleteTitle")}
                    description={t("deleteDescription", { name: team.name })}
                    confirmLabel={t("delete")}
                    onConfirm={() => run(() => deleteTeam({ id: team.id }), "team.teams.deleted")}
                  />
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {team.memberIds.length === 0 && (
                <span className="text-sm text-muted-foreground">{t("noMembers")}</span>
              )}
              {team.memberIds.map((id) => (
                <Badge key={id} variant="secondary">
                  {nameOf(id) ?? "—"}
                </Badge>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
