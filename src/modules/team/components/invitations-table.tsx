"use client"

import { Mail } from "lucide-react"
import { useFormatter, useNow, useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useActionRunner } from "@/lib/actions/use-action-runner"

import { revokeInvitation } from "../actions"
import type { PendingInvitation } from "../queries"

export function InvitationsTable({
  invitations,
  canManage,
}: {
  invitations: PendingInvitation[]
  canManage: boolean
}) {
  const t = useTranslations("team.invitations")
  const format = useFormatter()
  const now = useNow()
  const { run, pending } = useActionRunner()

  if (invitations.length === 0) {
    return <EmptyState icon={Mail} title={t("emptyTitle")} description={t("emptyDescription")} />
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("email")}</TableHead>
            <TableHead>{t("role")}</TableHead>
            <TableHead>{t("team")}</TableHead>
            <TableHead>{t("expires")}</TableHead>
            {canManage && <TableHead className="w-24" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((inv) => {
            const expired = new Date(inv.expires_at) < now
            return (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.email}</TableCell>
                <TableCell>{inv.role.name}</TableCell>
                <TableCell>{inv.team?.name ?? "—"}</TableCell>
                <TableCell>
                  {expired ? (
                    <StatusBadge tone="danger">{t("expired")}</StatusBadge>
                  ) : (
                    format.relativeTime(new Date(inv.expires_at), now)
                  )}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="sm" disabled={pending}>
                          {t("revoke")}
                        </Button>
                      }
                      title={t("revokeTitle")}
                      description={t("revokeDescription", { email: inv.email })}
                      confirmLabel={t("revoke")}
                      onConfirm={() =>
                        run(() => revokeInvitation({ id: inv.id }), "team.invitations.revoked")
                      }
                    />
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
