"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { cn } from "cn"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useMoney } from "@/hooks/use-money"
import type { StageOption } from "@/modules/crm-config/types"
import type { LeadRow } from "@/modules/leads/queries"

import { LeadCard } from "./lead-card"

type Props = {
  stage: StageOption
  leads: LeadRow[]
  summary: { count: number; total: number }
  currency: string
  memberName: (id: string | null) => string | undefined
  canDrag: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onOpen: (id: string) => void
}

export function BoardColumn({
  stage,
  leads,
  summary,
  currency,
  memberName,
  canDrag,
  loadingMore,
  onLoadMore,
  onOpen,
}: Props) {
  const t = useTranslations("pipeline")
  const money = useMoney()
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })

  return (
    <section aria-label={stage.name} className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/60">
      <header className="border-t-4 px-3 pt-2.5 pb-2" style={{ borderTopColor: stage.color }}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-sm font-semibold">{stage.name}</h2>
          <span
            className="rounded-full bg-background px-2 text-xs font-medium tabular-nums"
            data-testid="stage-count"
          >
            {summary.count}
          </span>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums" data-testid="stage-total">
          {money(summary.total, currency)}
        </p>
      </header>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 transition-colors",
          isOver && "bg-primary/5"
        )}
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              responsibleName={memberName(lead.responsibleId)}
              onOpen={onOpen}
              disabled={!canDrag}
            />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">{t("emptyColumn")}</p>
        )}
        {summary.count > leads.length && (
          <Button variant="ghost" size="sm" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore && <Spinner />}
            {t("loadMore", { count: summary.count - leads.length })}
          </Button>
        )}
      </div>
    </section>
  )
}
