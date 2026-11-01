"use client"

import {
  ArrowRightLeft,
  CheckCircle2,
  Circle,
  FileText,
  GitMerge,
  Link2,
  ListPlus,
  Paperclip,
  PenLine,
  Plus,
  StickyNote,
  Trash2,
  UserRound,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { useFormatter, useNow, useTranslations } from "next-intl"

import { EmptyState } from "@/components/shared/empty-state"

import type { ActivityItem } from "../queries"

const ICONS: Record<string, LucideIcon> = {
  "lead.created": Plus,
  "lead.stage_changed": ArrowRightLeft,
  "lead.responsible_changed": UserRound,
  "lead.updated": PenLine,
  "lead.contact_linked": Link2,
  "lead.deleted": Trash2,
  "note.added": StickyNote,
  "file.added": Paperclip,
  "task.created": ListPlus,
  "task.completed": CheckCircle2,
  "task.cancelled": XCircle,
  "contact.created": Plus,
  "company.created": Plus,
  "contact.merged": GitMerge,
}

const KNOWN = new Set(Object.keys(ICONS))

const str = (v: unknown) => (typeof v === "string" ? v : "")

/** Cronologia unificată a unei înregistrări (generată de triggerele din DB). */
export function Timeline({
  items,
  memberName,
}: {
  items: ActivityItem[]
  memberName: (id: string | null | undefined) => string | undefined
}) {
  const t = useTranslations("activity")
  const format = useFormatter()
  const now = useNow()

  if (items.length === 0) return <EmptyState icon={FileText} title={t("emptyTitle")} />

  function describe(item: ActivityItem) {
    const p = item.payload
    switch (item.type) {
      case "lead.stage_changed":
        return t("types.lead.stage_changed", { from: str(p.from), to: str(p.to) })
      case "lead.responsible_changed":
        return t("types.lead.responsible_changed", {
          to: memberName(str(p.to)) ?? t("nobody"),
        })
      case "lead.updated": {
        const fields = Object.keys((p.changes as Record<string, unknown>) ?? {})
        return t("types.lead.updated", {
          fields: fields.map((f) => (t.has(`fields.${f}`) ? t(`fields.${f}`) : f)).join(", "),
        })
      }
      case "note.added":
        return t("types.note.added", { excerpt: str(p.excerpt) })
      case "file.added":
        return t("types.file.added", { name: str(p.file_name) })
      case "task.created":
      case "task.completed":
      case "task.cancelled":
        return t(`types.${item.type}`, { title: str(p.title) })
      case "contact.merged":
        return t("types.contact.merged", { name: str(p.merged_name) })
      default:
        return KNOWN.has(item.type) ? t(`types.${item.type}`) : item.type
    }
  }

  return (
    <ol className="relative flex flex-col gap-4 border-l pl-6">
      {items.map((item) => {
        const Icon = ICONS[item.type] ?? Circle
        const date = new Date(item.occurredAt)
        return (
          <li key={item.id} className="relative">
            <span className="absolute top-0.5 -left-[2.1rem] flex size-6 items-center justify-center rounded-full border bg-card text-muted-foreground">
              <Icon className="size-3.5" />
            </span>
            <p className="text-sm whitespace-pre-line">{describe(item)}</p>
            <p className="text-xs text-muted-foreground">
              {memberName(item.actorId) ?? t("system")} ·{" "}
              <time
                dateTime={item.occurredAt}
                title={format.dateTime(date, { dateStyle: "medium", timeStyle: "short" })}
              >
                {format.relativeTime(date, now)}
              </time>
            </p>
          </li>
        )
      })}
    </ol>
  )
}
