"use client"

import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useRef, useState } from "react"

import type { StageOption } from "@/modules/crm-config/types"
import type { LeadRow } from "@/modules/leads/queries"

export type Columns = Record<string, LeadRow[]>
export type Summary = Record<string, { count: number; total: number }>

/** O mutare finalizată pe tablă, de confirmat pe server. */
export type PendingMove = {
  leadId: string
  stageId: string
  fromStageId: string
  beforeId: string | null
  afterId: string | null
}

const amountOf = (lead: LeadRow) =>
  lead.stage.kind === "won" ? (lead.wonAmount ?? lead.value) : lead.value

/**
 * Starea tablei Kanban: mutări optimiste între / în cadrul coloanelor, cu sumele
 * actualizate imediat și posibilitatea de revenire dacă serverul refuză.
 */
export function useBoardState(
  stages: StageOption[],
  initialColumns: Columns,
  initialSummary: Summary
) {
  const [columns, setColumns] = useState(initialColumns)
  const [summary, setSummary] = useState(initialSummary)
  const [activeId, setActiveId] = useState<string | null>(null)
  const snapshot = useRef<{ columns: Columns; summary: Summary; fromStageId: string } | null>(null)
  const stageById = new Map(stages.map((s) => [s.id, s]))

  const containerOf = (id: string, cols: Columns = columns) =>
    stageById.has(id)
      ? id
      : Object.keys(cols).find((stageId) => cols[stageId]!.some((l) => l.id === id))

  function onDragStart({ active }: DragStartEvent) {
    const fromStageId = containerOf(String(active.id))
    if (!fromStageId) return
    setActiveId(String(active.id))
    snapshot.current = { columns, summary, fromStageId }
  }

  // Trecerea peste altă coloană mută cardul imediat acolo (feedback vizual).
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const from = containerOf(String(active.id))
    const to = containerOf(String(over.id))
    if (!from || !to || from === to) return

    setColumns((cols) => {
      const lead = cols[from]!.find((l) => l.id === active.id)
      if (!lead) return cols
      const target = cols[to]!
      const overIndex = target.findIndex((l) => l.id === over.id)
      const index = overIndex >= 0 ? overIndex : target.length
      const stage = stageById.get(to)!
      const moved = {
        ...lead,
        stage: { id: stage.id, name: stage.name, color: stage.color, kind: stage.kind },
      }
      return {
        ...cols,
        [from]: cols[from]!.filter((l) => l.id !== active.id),
        [to]: [...target.slice(0, index), moved, ...target.slice(index)],
      }
    })
  }

  /** Returnează mutarea de confirmat, sau null dacă nimic nu s-a schimbat. */
  function onDragEnd({ active, over }: DragEndEvent): PendingMove | null {
    setActiveId(null)
    const snap = snapshot.current
    if (!over || !snap) {
      revert()
      return null
    }

    const leadId = String(active.id)
    const stageId = containerOf(leadId)!
    let list = columns[stageId]!
    const from = list.findIndex((l) => l.id === leadId)
    const overIndex = list.findIndex((l) => l.id === over.id)
    if (overIndex >= 0 && overIndex !== from) {
      list = arrayMove(list, from, overIndex)
      setColumns((cols) => ({ ...cols, [stageId]: list }))
    }

    const index = list.findIndex((l) => l.id === leadId)
    const originalIndex = snap.columns[snap.fromStageId]!.findIndex((l) => l.id === leadId)
    if (stageId === snap.fromStageId && index === originalIndex) return null

    if (stageId !== snap.fromStageId) {
      const lead = list[index]!
      const before = snap.columns[snap.fromStageId]!.find((l) => l.id === leadId)!
      setSummary((s) => ({
        ...s,
        [snap.fromStageId]: {
          count: (s[snap.fromStageId]?.count ?? 1) - 1,
          total: (s[snap.fromStageId]?.total ?? 0) - amountOf(before),
        },
        [stageId]: {
          count: (s[stageId]?.count ?? 0) + 1,
          total: (s[stageId]?.total ?? 0) + amountOf(lead),
        },
      }))
    }

    return {
      leadId,
      stageId,
      fromStageId: snap.fromStageId,
      beforeId: list[index - 1]?.id ?? null,
      afterId: list[index + 1]?.id ?? null,
    }
  }

  function revert() {
    if (snapshot.current) {
      setColumns(snapshot.current.columns)
      setSummary(snapshot.current.summary)
    }
    setActiveId(null)
  }

  function appendLeads(stageId: string, leads: LeadRow[]) {
    setColumns((cols) => {
      const known = new Set(cols[stageId]!.map((l) => l.id))
      return { ...cols, [stageId]: [...cols[stageId]!, ...leads.filter((l) => !known.has(l.id))] }
    })
  }

  const activeLead = activeId
    ? Object.values(columns)
        .flat()
        .find((l) => l.id === activeId)
    : undefined

  return { columns, summary, activeLead, onDragStart, onDragOver, onDragEnd, revert, appendLeads }
}
