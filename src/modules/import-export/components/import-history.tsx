"use client"

import { Download } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"

import { StatusBadge, type StatusTone } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { ImportJobRow, ImportJobStatus } from "../queries"

const TONE: Record<ImportJobStatus, StatusTone> = {
  processing: "info",
  done: "success",
  cancelled: "warning",
  failed: "danger",
  interrupted: "warning",
}

/** Ultimele importuri: fișier, stare, contoare, raportul de erori. */
export function ImportHistory({ jobs }: { jobs: ImportJobRow[] }) {
  const t = useTranslations("importExport.history")
  const tie = useTranslations("importExport")
  const format = useFormatter()

  if (jobs.length === 0) return <p className="text-sm text-muted-foreground">{t("empty")}</p>

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("file")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead className="text-right">{t("ok")}</TableHead>
            <TableHead className="text-right">{t("skipped")}</TableHead>
            <TableHead className="text-right">{t("failed")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("author")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell>
                <p className="max-w-56 truncate font-medium">{job.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {tie(`entities.${job.entity}`)} ·{" "}
                  {format.dateTime(new Date(job.createdAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </TableCell>
              <TableCell>
                <StatusBadge tone={TONE[job.status]}>{t(`statuses.${job.status}`)}</StatusBadge>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("processed", { processed: job.processedRows, total: job.totalRows })}
                </p>
              </TableCell>
              <TableCell className="text-right tabular-nums">{job.okCount}</TableCell>
              <TableCell className="text-right tabular-nums">{job.skippedCount}</TableCell>
              <TableCell className="text-right tabular-nums">{job.failedCount}</TableCell>
              <TableCell className="hidden md:table-cell">{job.author ?? "—"}</TableCell>
              <TableCell className="text-right">
                {job.hasErrors && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={`/settings/import-export/${job.id}/errors`} download>
                      <Download />
                      {t("errors")}
                    </a>
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
