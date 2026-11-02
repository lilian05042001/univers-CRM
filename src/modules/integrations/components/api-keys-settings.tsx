"use client"

import { Ban, KeyRound } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { CopyField } from "@/components/shared/copy-field"
import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useActionRunner } from "@/lib/actions/use-action-runner"

import { revokeApiKey } from "../actions"
import type { ApiKeyRow, ApiKeyStatus } from "../queries"

import { ApiKeyDialog } from "./api-key-dialog"

const STATUS_TONE: Record<ApiKeyStatus, StatusTone> = {
  active: "success",
  expired: "warning",
  revoked: "neutral",
}

/** Cheile API ale organizației: creare (afișată o singură dată), stare, ultima utilizare, revocare. */
export function ApiKeysSettings({ keys, canManage }: { keys: ApiKeyRow[]; canManage: boolean }) {
  const t = useTranslations("integrations.api")
  const format = useFormatter()
  const { run, pending } = useActionRunner()
  const [secret, setSecret] = useState<string | null>(null)
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">{t("intro")}</p>
        {canManage && <ApiKeyDialog onCreated={setSecret} />}
      </div>

      {keys.length === 0 ? (
        <EmptyState icon={KeyRound} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <Card className="py-0">
          <CardContent className="divide-y px-0">
            {keys.map((key) => (
              <div key={key.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{key.name}</p>
                    <StatusBadge tone={STATUS_TONE[key.status]}>
                      {t(`status.${key.status}`)}
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <code>{key.prefix}…</code> ·{" "}
                    {key.scopes.map((s) => t(`scopeLabels.${s.replace(":", "_")}`)).join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("createdBy", { date: date(key.createdAt), author: key.author ?? "—" })} ·{" "}
                    {key.lastUsedAt
                      ? t("lastUsed", { date: date(key.lastUsedAt) })
                      : t("neverUsed")}
                    {key.expiresAt && key.status === "active" && (
                      <> · {t("expiresAt", { date: date(key.expiresAt) })}</>
                    )}
                  </p>
                </div>
                {canManage && key.status === "active" && (
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="sm" disabled={pending}>
                        <Ban />
                        {t("revoke")}
                      </Button>
                    }
                    title={t("revokeTitle")}
                    description={t("revokeDescription", { name: key.name })}
                    confirmLabel={t("revoke")}
                    onConfirm={() =>
                      run(() => revokeApiKey({ id: key.id }), "integrations.api.revoked")
                    }
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={secret !== null} onOpenChange={(open) => !open && setSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("secretTitle")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t("secretHint")}</p>
          {secret && <CopyField label={t("secret")} value={secret} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
