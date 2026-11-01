"use client"

import { Lock, Pencil, Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
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
import { ADMIN_ROLE_KEY, isPermission } from "@/modules/auth/permissions"

import { deleteRole } from "../actions"
import type { Role } from "../queries"

import { RoleDialog, permissionMessageKey } from "./role-dialog"

export function RolesList({ roles, canManage }: { roles: Role[]; canManage: boolean }) {
  const t = useTranslations("settings.roles")
  const tPerm = useTranslations("permissions")
  const { run, pending } = useActionRunner()

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <RoleDialog
            trigger={
              <Button>
                <Plus />
                {t("create")}
              </Button>
            }
          />
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {roles.map((role) => {
          const isAdmin = role.key === ADMIN_ROLE_KEY
          return (
            <Card key={role.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {role.name}
                  {role.is_system && <StatusBadge tone="info">{t("system")}</StatusBadge>}
                </CardTitle>
                <CardDescription>
                  {role.description ?? "—"} · {t("memberCount", { count: role.memberCount })}
                </CardDescription>
                {canManage && !isAdmin && (
                  <CardAction className="flex gap-1">
                    <RoleDialog
                      role={role}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={t("edit")}>
                          <Pencil />
                        </Button>
                      }
                    />
                    {!role.is_system && (
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
                        description={t("deleteDescription", { name: role.name })}
                        confirmLabel={t("delete")}
                        onConfirm={() =>
                          run(() => deleteRole({ id: role.id }), "settings.roles.deleted")
                        }
                      />
                    )}
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {isAdmin ? (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Lock className="size-3.5" />
                    {t("allPermissions")}
                  </span>
                ) : role.permissions.length === 0 ? (
                  <span className="text-sm text-muted-foreground">{t("noPermissions")}</span>
                ) : (
                  role.permissions.filter(isPermission).map((p) => (
                    <Badge key={p} variant="secondary">
                      {tPerm(permissionMessageKey(p))}
                    </Badge>
                  ))
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
