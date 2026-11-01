"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "cn"
import { Clock } from "lucide-react"
import { useFormatter, useNow } from "next-intl"

import { TagBadge } from "@/components/shared/tag-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useMoney } from "@/hooks/use-money"
import { initials } from "@/lib/utils/format"
import type { LeadRow } from "@/modules/leads/queries"

const priorityColor = {
  low: "bg-muted-foreground/40",
  normal: "bg-info",
  high: "bg-warning",
  urgent: "bg-destructive",
} as const

export type CardProps = {
  lead: LeadRow
  responsibleName?: string
  onOpen?: (id: string) => void
}

/** Conținutul cardului (folosit și în DragOverlay). */
export function LeadCardBody({
  lead,
  responsibleName,
  dragging,
}: CardProps & { dragging?: boolean }) {
  const money = useMoney()
  const format = useFormatter()
  const now = useNow()
  const due = lead.nextTaskDueAt ? new Date(lead.nextTaskDueAt) : null
  const amount = lead.stage.kind === "won" ? (lead.wonAmount ?? lead.value) : lead.value

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border bg-card p-3 text-sm shadow-xs",
        dragging && "rotate-1 shadow-lg ring-2 ring-primary/40"
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn("mt-1.5 size-2 shrink-0 rounded-full", priorityColor[lead.priority])}
          aria-hidden
        />
        <p className="line-clamp-2 font-medium">{lead.title}</p>
      </div>
      {(lead.contactName || lead.companyName) && (
        <p className="truncate text-xs text-muted-foreground">
          {[lead.contactName, lead.companyName].filter(Boolean).join(" · ")}
        </p>
      )}
      {lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {lead.tags.map((t) => (
            <TagBadge key={t.id} name={t.name} color={t.color} />
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 pt-0.5">
        <span className="font-semibold tabular-nums">{money(amount, lead.currency)}</span>
        {due && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs",
              due < now ? "font-medium text-destructive" : "text-muted-foreground"
            )}
          >
            <Clock className="size-3" />
            {format.relativeTime(due, now)}
          </span>
        )}
        {responsibleName && (
          <Avatar className="ml-auto size-6" title={responsibleName}>
            <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
              {initials(responsibleName)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  )
}

/** Card sortabil pe tablă; click (fără tragere) deschide lead-ul. */
export function LeadCard({
  lead,
  responsibleName,
  onOpen,
  disabled,
}: CardProps & { disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    disabled,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("touch-manipulation outline-none", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(lead.id)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e)
        if (e.key === "Enter") onOpen?.(lead.id)
      }}
    >
      <LeadCardBody lead={lead} responsibleName={responsibleName} />
    </div>
  )
}
