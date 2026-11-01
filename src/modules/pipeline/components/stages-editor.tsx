"use client"

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Lock, Pencil, Plus, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useId, useState } from "react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import type { StageOption } from "@/modules/crm-config/types"

import { deleteStage, reorderStages } from "../settings-actions"

import { StageDialog } from "./settings-dialogs"

export type EditableStage = StageOption

function StageRow({
  stage,
  pipelineId,
  sortable,
}: {
  stage: EditableStage
  pipelineId: string
  sortable: boolean
}) {
  const t = useTranslations("settings.pipelines")
  const { run, pending } = useActionRunner()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    disabled: !sortable,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex items-center gap-3 border-b bg-card px-3 py-2.5 last:border-b-0 ${isDragging ? "relative z-10 shadow-md" : ""}`}
    >
      {sortable ? (
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground"
          aria-label={t("dragStage", { name: stage.name })}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      ) : (
        <Lock className="size-4 text-muted-foreground" aria-label={t("finalStage")} />
      )}
      <span
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: stage.color }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate font-medium">{stage.name}</span>
      {stage.kind !== "open" && (
        <StatusBadge tone={stage.kind === "won" ? "success" : "danger"}>
          {t(`kinds.${stage.kind}`)}
        </StatusBadge>
      )}
      <span className="w-12 text-right text-sm text-muted-foreground tabular-nums">
        {stage.probability}%
      </span>
      <StageDialog
        pipelineId={pipelineId}
        stage={stage}
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={t("editStage")}>
            <Pencil />
          </Button>
        }
      />
      {stage.kind === "open" ? (
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-sm" aria-label={t("deleteStage")} disabled={pending}>
              <Trash2 />
            </Button>
          }
          title={t("deleteStageTitle")}
          description={t("deleteStageDescription", { name: stage.name })}
          confirmLabel={t("deleteStage")}
          onConfirm={() =>
            run(() => deleteStage({ id: stage.id }), "settings.pipelines.stageDeleted")
          }
        />
      ) : (
        <span className="size-7" />
      )}
    </li>
  )
}

/** Etapele unui pipeline: cele deschise se reordonează prin tragere, cele finale rămân la sfârșit. */
export function StagesEditor({
  pipelineId,
  stages,
}: {
  pipelineId: string
  stages: EditableStage[]
}) {
  const t = useTranslations("settings.pipelines")
  const { run } = useActionRunner()
  const [open, setOpen] = useState(stages.filter((s) => s.kind === "open"))
  const finals = stages.filter((s) => s.kind !== "open")
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Sincronizare după reîncărcarea datelor (etapă nouă / ștearsă).
  const key = stages.map((s) => s.id).join()
  const [syncedKey, setSyncedKey] = useState(key)
  if (key !== syncedKey) {
    setSyncedKey(key)
    setOpen(stages.filter((s) => s.kind === "open"))
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const next = arrayMove(
      open,
      open.findIndex((s) => s.id === active.id),
      open.findIndex((s) => s.id === over.id)
    )
    setOpen(next)
    run(
      () => reorderStages({ pipelineId, stageIds: next.map((s) => s.id) }),
      "settings.pipelines.reordered"
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="overflow-hidden rounded-lg border">
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={open.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            {open.map((s) => (
              <StageRow key={s.id} stage={s} pipelineId={pipelineId} sortable />
            ))}
          </SortableContext>
        </DndContext>
        {finals.map((s) => (
          <StageRow key={s.id} stage={s} pipelineId={pipelineId} sortable={false} />
        ))}
      </ul>
      <StageDialog
        pipelineId={pipelineId}
        trigger={
          <Button variant="outline" size="sm" className="w-fit">
            <Plus />
            {t("createStage")}
          </Button>
        }
      />
    </div>
  )
}
