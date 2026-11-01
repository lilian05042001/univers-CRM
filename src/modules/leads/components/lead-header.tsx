"use client"

import { ArrowLeft, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useListNavigation } from "@/hooks/use-list-navigation"
import { useMoney } from "@/hooks/use-money"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import type { CrmOptions } from "@/modules/crm-config/types"
import { moveCard } from "@/modules/pipeline/actions"

import { assignLeads, deleteLeads } from "../actions"
import type { LeadDetail } from "../queries"

import { LossReasonDialog } from "./loss-reason-dialog"

const NONE = "__none__"

/** Antetul fișei: titlu, sumă, etapă și responsabil modificabile direct, editare, ștergere. */
export function LeadHeader({
  lead,
  options,
  can,
}: {
  lead: LeadDetail
  options: CrmOptions
  can: { edit: boolean; assign: boolean; delete: boolean }
}) {
  const t = useTranslations("leads.detail")
  const tStatus = useTranslations("leads.status")
  const money = useMoney()
  const router = useRouter()
  const { setParams } = useListNavigation()
  const { run, pending } = useActionRunner()
  const [lostStage, setLostStage] = useState<string | null>(null)
  const pipeline = options.pipelines.find((p) => p.id === lead.pipeline_id)
  const amount = lead.status === "won" ? Number(lead.won_amount ?? lead.value) : Number(lead.value)

  function changeStage(stageId: string, lossReasonId: string | null = null) {
    run(
      () => moveCard({ leadId: lead.id, stageId, beforeId: null, afterId: null, lossReasonId }),
      "leads.detail.stageChanged"
    )
  }

  return (
    <div className="mb-6 flex flex-col gap-4">
      <Link
        href="/leads"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{lead.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="text-lg font-semibold text-foreground tabular-nums">
              {money(amount, lead.currency)}
            </span>
            <StatusBadge
              tone={lead.status === "won" ? "success" : lead.status === "lost" ? "danger" : "info"}
              dot
            >
              {tStatus(lead.status)}
            </StatusBadge>
            {pipeline && options.pipelines.length > 1 && <span>{pipeline.name}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={lead.stage.id}
            disabled={!can.edit || pending}
            onValueChange={(stageId) => {
              const kind = pipeline?.stages.find((s) => s.id === stageId)?.kind
              if (kind === "lost") setLostStage(stageId)
              else changeStage(stageId)
            }}
          >
            <SelectTrigger className="w-56" aria-label={t("stage")}>
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: lead.stage.color }}
              />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pipeline?.stages.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={lead.responsible_id ?? NONE}
            disabled={!can.assign || pending}
            onValueChange={(v) =>
              run(
                () => assignLeads({ ids: [lead.id], responsibleId: v === NONE ? null : v }),
                "leads.bulk.assigned"
              )
            }
          >
            <SelectTrigger className="w-48" aria-label={t("responsible")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("unassigned")}</SelectItem>
              {options.members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {can.edit && (
            <Button
              variant="outline"
              onClick={() => setParams({ open: "edit" }, { resetPage: false })}
            >
              <Pencil />
              {t("edit")}
            </Button>
          )}
          {can.delete && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon" aria-label={t("delete")} disabled={pending}>
                  <Trash2 />
                </Button>
              }
              title={t("deleteTitle")}
              description={t("deleteDescription", { title: lead.title })}
              confirmLabel={t("delete")}
              onConfirm={() =>
                run(
                  () => deleteLeads({ ids: [lead.id] }),
                  "leads.bulk.deleted",
                  () => router.push("/leads")
                )
              }
            />
          )}
        </div>
      </div>
      {lostStage && (
        <LossReasonDialog
          reasons={options.lossReasons}
          onCancel={() => setLostStage(null)}
          onConfirm={(reason) => {
            setLostStage(null)
            changeStage(lostStage, reason)
          }}
        />
      )}
    </div>
  )
}
