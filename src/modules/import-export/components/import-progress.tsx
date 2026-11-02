"use client"

import { Download, RotateCcw, Square } from "lucide-react"
import { useTranslations } from "next-intl"

import { StatusBadge, type StatusTone } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"

import type { ImportProgress } from "../hooks/use-import-runner"

const TONE: Record<ImportProgress["phase"], StatusTone> = {
  idle: "neutral",
  running: "info",
  done: "success",
  cancelled: "warning",
  failed: "danger",
}

/** Progresul importului în curs și rezumatul la final (cu raportul de erori). */
export function ImportProgressPanel({
  progress,
  onCancel,
  onReset,
}: {
  progress: ImportProgress
  onCancel: () => void
  onReset: () => void
}) {
  const t = useTranslations("importExport")
  const tRoot = useTranslations()
  const percent = progress.total ? Math.round((progress.processed / progress.total) * 100) : 0
  const running = progress.phase === "running"
  const hasErrors = progress.failed + progress.skipped > 0

  return (
    <div className="flex flex-col gap-4 rounded-md border p-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        {running && <Spinner />}
        <StatusBadge tone={TONE[progress.phase]}>{t(`progress.${progress.phase}`)}</StatusBadge>
        <span className="text-sm text-muted-foreground" data-testid="import-processed">
          {t("progress.rows", { processed: progress.processed, total: progress.total })}
        </span>
        <div className="ml-auto flex gap-2">
          {running ? (
            <Button variant="outline" size="sm" onClick={onCancel}>
              <Square />
              {t("progress.cancel")}
            </Button>
          ) : (
            <>
              {hasErrors && progress.jobId && (
                <Button asChild variant="outline" size="sm">
                  <a href={`/settings/import-export/${progress.jobId}/errors`} download>
                    <Download />
                    {t("progress.errorReport")}
                  </a>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={onReset}>
                <RotateCcw />
                {t("progress.again")}
              </Button>
            </>
          )}
        </div>
      </div>
      <Progress value={percent} aria-label={t("progress.label")} />
      <dl className="grid grid-cols-3 gap-3 text-sm">
        {(["ok", "skipped", "failed"] as const).map((key) => (
          <div key={key} className="rounded-md bg-muted/50 p-3" data-stat={key}>
            <dt className="text-xs text-muted-foreground">{t(`progress.stats.${key}`)}</dt>
            <dd className="text-lg font-semibold tabular-nums">{progress[key]}</dd>
          </div>
        ))}
      </dl>
      {progress.error && <p className="text-sm text-destructive">{tRoot(progress.error)}</p>}
    </div>
  )
}
