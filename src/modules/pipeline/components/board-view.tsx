"use client"

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useId, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { FilterSelect, Toolbar } from "@/components/shared/data-table/toolbar"
import { Button } from "@/components/ui/button"
import { useListNavigation } from "@/hooks/use-list-navigation"
import { useRouteDialog } from "@/hooks/use-route-dialog"
import { nameById } from "@/modules/crm-config/options"
import type { CrmOptions } from "@/modules/crm-config/types"
import { LeadFormDialog } from "@/modules/leads/components/lead-form-dialog"
import { LossReasonDialog } from "@/modules/leads/components/loss-reason-dialog"
import type { LeadRecord } from "@/modules/leads/queries"
import { PRIORITIES } from "@/modules/leads/schemas"

import { loadStageLeads, moveCard } from "../actions"
import {
  useBoardState,
  type Columns,
  type PendingMove,
  type Summary,
} from "../hooks/use-board-state"
import type { BoardFilters } from "../schemas"

import { BoardColumn } from "./board-column"
import { LeadCardBody } from "./lead-card"

type Props = {
  pipelineId: string
  columns: Columns
  summary: Summary
  filters: BoardFilters
  options: CrmOptions
  currency: string
  record: LeadRecord | null
  isNew: boolean
  userId: string
  can: { create: boolean; edit: boolean; assign: boolean }
}

export function BoardView({
  pipelineId,
  columns: initialColumns,
  summary: initialSummary,
  filters,
  options,
  currency,
  record,
  isNew,
  userId,
  can,
}: Props) {
  const t = useTranslations("pipeline")
  const tLeads = useTranslations("leads")
  const tAll = useTranslations()
  const { setParams } = useListNavigation()
  const routeDialog = useRouteDialog()
  const router = useRouter()
  const [lostMove, setLostMove] = useState<PendingMove | null>(null)
  const [loadingStage, setLoadingStage] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const pipeline = options.pipelines.find((p) => p.id === pipelineId)!
  const board = useBoardState(pipeline.stages, initialColumns, initialSummary)
  // ID stabil între server și client (altfel dnd-kit generează ID-uri incrementale → hydration mismatch).
  const dndId = useId()
  const memberName = nameById(options.members)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function commit(move: PendingMove, lossReasonId: string | null = null) {
    startTransition(async () => {
      const result = await moveCard({ ...move, lossReasonId })
      if (!result.ok) {
        board.revert()
        toast.error(tAll(result.error))
      }
    })
  }

  function onDragEnd(event: Parameters<typeof board.onDragEnd>[0]) {
    endDrag()
    const move = board.onDragEnd(event)
    if (!move) return
    const kind = pipeline.stages.find((s) => s.id === move.stageId)?.kind
    if (kind === "lost" && move.stageId !== move.fromStageId) setLostMove(move)
    else commit(move)
  }

  function loadMore(stageId: string) {
    setLoadingStage(stageId)
    startTransition(async () => {
      const result = await loadStageLeads({
        stageId,
        offset: board.columns[stageId]!.length,
        filters,
      })
      setLoadingStage(null)
      if (result.ok) board.appendLeads(stageId, result.data)
      else toast.error(tAll(result.error))
    })
  }

  // După o tragere browserul trimite și un „click” pe card: îl ignorăm, altfel s-ar deschide fișa.
  const dragging = useRef(false)
  const endDrag = () => setTimeout(() => (dragging.current = false), 0)
  const open = (id: string) => {
    if (!dragging.current) router.push(`/leads/${id}`)
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex items-start gap-3">
        <Toolbar filterKeys={["responsible", "priority"]}>
          {options.pipelines.length > 1 && (
            <FilterSelect
              param="pipeline"
              label={t("pipeline")}
              options={options.pipelines.map((p) => ({ value: p.id, label: p.name }))}
            />
          )}
          <FilterSelect
            param="responsible"
            label={tLeads("filters.responsible")}
            options={[
              { value: "me", label: tLeads("filters.me") },
              { value: "none", label: tLeads("unassigned") },
              ...options.members.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
          <FilterSelect
            param="priority"
            label={tLeads("filters.priority")}
            options={PRIORITIES.map((p) => ({ value: p, label: tLeads(`priority.${p}`) }))}
          />
        </Toolbar>
        {can.create && (
          <Button onClick={() => setParams({ open: "new" }, { resetPage: false })}>
            <Plus />
            {tLeads("create")}
          </Button>
        )}
      </div>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(event) => {
          dragging.current = true
          board.onDragStart(event)
        }}
        onDragOver={board.onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          endDrag()
          board.revert()
        }}
        accessibility={{
          screenReaderInstructions: { draggable: t("dragInstructions") },
        }}
      >
        <div className="-mx-4 flex min-h-[60vh] gap-3 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
          {pipeline.stages.map((stage) => (
            <BoardColumn
              key={stage.id}
              stage={stage}
              leads={board.columns[stage.id] ?? []}
              summary={board.summary[stage.id] ?? { count: 0, total: 0 }}
              currency={currency}
              memberName={memberName}
              canDrag={can.edit}
              loadingMore={loadingStage === stage.id}
              onLoadMore={() => loadMore(stage.id)}
              onOpen={open}
            />
          ))}
        </div>
        <DragOverlay>
          {board.activeLead && (
            <LeadCardBody
              lead={board.activeLead}
              responsibleName={memberName(board.activeLead.responsibleId)}
              dragging
            />
          )}
        </DragOverlay>
      </DndContext>

      {lostMove && (
        <LossReasonDialog
          reasons={options.lossReasons}
          onCancel={() => {
            setLostMove(null)
            board.revert()
          }}
          onConfirm={(lossReasonId) => {
            const move = lostMove
            setLostMove(null)
            commit(move, lossReasonId)
          }}
        />
      )}
      {routeDialog.openParam && (isNew || record) && (
        <LeadFormDialog
          key={record?.id ?? "new"}
          record={record}
          options={options}
          canAssign={can.assign}
          userId={userId}
          onClose={routeDialog.close}
        />
      )}
    </div>
  )
}
