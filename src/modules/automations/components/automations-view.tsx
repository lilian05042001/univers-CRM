"use client"

import { History, Plus, Workflow } from "lucide-react"
import Link from "next/link"
import { useFormatter, useNow, useTranslations } from "next-intl"

import { EmptyState } from "@/components/shared/empty-state"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useActionRunner } from "@/lib/actions/use-action-runner"

import { setAutomationActive } from "../actions"
import { i18nKey } from "../fields"
import type { AutomationListItem } from "../queries"
import { TEMPLATE_KEYS, TEMPLATE_TRIGGERS } from "../templates"

import { RUN_TONES } from "./run-status"

export function AutomationsView({
  automations,
  canManage,
}: {
  automations: AutomationListItem[]
  canManage: boolean
}) {
  const t = useTranslations("automations")
  const format = useFormatter()
  const now = useNow()
  const { run, pending } = useActionRunner()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2">
        {canManage && (
          <Button asChild>
            <Link href="/automations/new">
              <Plus />
              {t("create")}
            </Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/automations/runs">
            <History />
            {t("runs.title")}
          </Link>
        </Button>
      </div>

      {automations.length === 0 ? (
        <EmptyState icon={Workflow} title={t("emptyTitle")} description={t("emptyHint")} />
      ) : (
        <Card className="py-0">
          <CardContent className="divide-y px-0">
            {automations.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/automations/${a.id}`} className="font-medium hover:underline">
                    {a.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {t(`triggers.${i18nKey(a.trigger_type)}`)} →{" "}
                    {a.actions.map((x) => t(`actions.types.${x.type}`)).join(", ")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                  {a.lastRun ? (
                    <span className="flex items-center gap-2">
                      <StatusBadge tone={RUN_TONES[a.lastRun.status]} dot>
                        {t(`runs.status.${a.lastRun.status}`)}
                      </StatusBadge>
                      {format.relativeTime(new Date(a.lastRun.startedAt), now)}
                    </span>
                  ) : (
                    <span>{t("neverRan")}</span>
                  )}
                  <span>{t("stats", { runs: a.runs30d, failures: a.failures30d })}</span>
                </div>
                <Switch
                  checked={a.is_active}
                  disabled={!canManage || pending}
                  aria-label={t("toggle", { name: a.name })}
                  onCheckedChange={(isActive) =>
                    run(
                      () => setAutomationActive({ id: a.id, isActive }),
                      isActive ? "automations.activated" : "automations.deactivated"
                    )
                  }
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canManage && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">{t("templatesTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("templatesHint")}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {TEMPLATE_KEYS.map((key) => (
              <Link
                key={key}
                href={`/automations/new?template=${key}`}
                className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/60"
              >
                <p className="font-medium">{t(`templates.${key}.name`)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`templates.${key}.description`)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t(`triggers.${i18nKey(TEMPLATE_TRIGGERS[key])}`)}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
