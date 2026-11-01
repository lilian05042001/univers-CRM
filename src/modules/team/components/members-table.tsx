"use client"

import { MoreHorizontal, UserCheck, UserMinus, UserX } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import { initials } from "@/lib/utils/format"

import { removeMember, updateMember } from "../actions"
import type { Member, Role } from "../queries"

type MembersTableProps = {
  members: Member[]
  roles: Pick<Role, "id" | "name">[]
  canManage: boolean
  currentUserId: string
}

export function MembersTable({ members, roles, canManage, currentUserId }: MembersTableProps) {
  const t = useTranslations("team.members")
  const { run, pending } = useActionRunner()

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead className="w-48">{t("role")}</TableHead>
            <TableHead className="w-32">{t("status")}</TableHead>
            {canManage && <TableHead className="w-12" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => {
            const name = m.profile.full_name || m.profile.email
            const isSelf = m.profile.id === currentUserId
            return (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary/10 text-xs text-primary">
                        {initials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {name}
                        {isSelf && <span className="ml-1 text-muted-foreground">({t("you")})</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{m.profile.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <Select
                      value={m.role.id}
                      disabled={pending}
                      onValueChange={(roleId) =>
                        run(
                          () => updateMember({ membershipId: m.id, roleId }),
                          "team.members.roleChanged"
                        )
                      }
                    >
                      <SelectTrigger size="sm" className="w-full" aria-label={t("role")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    m.role.name
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={m.status === "active" ? "success" : "neutral"} dot>
                    {t(`statuses.${m.status}`)}
                  </StatusBadge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("actions")}
                          disabled={pending}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {m.status === "active" ? (
                          <DropdownMenuItem
                            onSelect={() =>
                              run(
                                () => updateMember({ membershipId: m.id, status: "disabled" }),
                                "team.members.disabled"
                              )
                            }
                          >
                            <UserX />
                            {t("disable")}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onSelect={() =>
                              run(
                                () => updateMember({ membershipId: m.id, status: "active" }),
                                "team.members.activated"
                              )
                            }
                          >
                            <UserCheck />
                            {t("activate")}
                          </DropdownMenuItem>
                        )}
                        <ConfirmDialog
                          trigger={
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={(e) => e.preventDefault()}
                            >
                              <UserMinus />
                              {t("remove")}
                            </DropdownMenuItem>
                          }
                          title={t("removeTitle")}
                          description={t("removeDescription", { name })}
                          confirmLabel={t("remove")}
                          onConfirm={() =>
                            run(() => removeMember({ membershipId: m.id }), "team.members.removed")
                          }
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
