"use client"

import { Pencil, Plus, Star, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useListNavigation } from "@/hooks/use-list-navigation"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import type { NamedOption, PipelineOption } from "@/modules/crm-config/types"

import type { AssignmentRule } from "../queries"
import { deletePipeline, setDefaultPipeline } from "../settings-actions"

import { AssignmentRuleForm } from "./assignment-rule-form"
import { PipelineDialog } from "./settings-dialogs"
import { StagesEditor } from "./stages-editor"

export function PipelinesSettings({
  pipelines,
  rules,
  members,
  selectedId,
}: {
  pipelines: PipelineOption[]
  rules: AssignmentRule[]
  members: NamedOption[]
  selectedId: string
}) {
  const t = useTranslations("settings.pipelines")
  const { setParams } = useListNavigation()
  const { run, pending } = useActionRunner()
  const pipeline = pipelines.find((p) => p.id === selectedId) ?? pipelines[0]!

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {pipelines.map((p) => (
          <Button
            key={p.id}
            variant={p.id === pipeline.id ? "default" : "outline"}
            size="sm"
            onClick={() => setParams({ pipeline: p.id })}
          >
            {p.isDefault && <Star className="fill-current" />}
            {p.name}
          </Button>
        ))}
        <PipelineDialog
          trigger={
            <Button variant="ghost" size="sm">
              <Plus />
              {t("create")}
            </Button>
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {pipeline.name}
            {pipeline.isDefault && <StatusBadge tone="info">{t("default")}</StatusBadge>}
          </CardTitle>
          <CardDescription>{t("stagesDescription")}</CardDescription>
          <CardAction className="flex gap-1">
            {!pipeline.isDefault && (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () => setDefaultPipeline({ id: pipeline.id }),
                    "settings.pipelines.defaultSet"
                  )
                }
              >
                <Star />
                {t("makeDefault")}
              </Button>
            )}
            <PipelineDialog
              pipeline={pipeline}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label={t("rename")}>
                  <Pencil />
                </Button>
              }
            />
            {!pipeline.isDefault && (
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("delete")}
                    disabled={pending}
                  >
                    <Trash2 />
                  </Button>
                }
                title={t("deleteTitle")}
                description={t("deleteDescription", { name: pipeline.name })}
                confirmLabel={t("delete")}
                onConfirm={() =>
                  run(
                    () => deletePipeline({ id: pipeline.id }),
                    "settings.pipelines.deleted",
                    () => setParams({ pipeline: null })
                  )
                }
              />
            )}
          </CardAction>
        </CardHeader>
        <CardContent>
          <StagesEditor key={pipeline.id} pipelineId={pipeline.id} stages={pipeline.stages} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("assignment.title")}</CardTitle>
          <CardDescription>{t("assignment.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AssignmentRuleForm
            key={pipeline.id}
            pipelineId={pipeline.id}
            rule={rules.find((r) => r.pipelineId === pipeline.id)}
            members={members}
          />
        </CardContent>
      </Card>
    </div>
  )
}
