"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { finishImport, importBatch, startImport } from "../actions"
import { buildBatches, countDataRows } from "../batches"
import type { ImportEntity } from "../fields"

export type ImportOptions = {
  skipDuplicates: boolean
  createCompanies: boolean
  defaultOwnerId: string | null
}

export type ImportProgress = {
  phase: "idle" | "running" | "done" | "cancelled" | "failed"
  jobId: string | null
  total: number
  processed: number
  ok: number
  skipped: number
  failed: number
  /** Cheia i18n a erorii care a oprit importul. */
  error: string | null
}

const IDLE: ImportProgress = {
  phase: "idle",
  jobId: null,
  total: 0,
  processed: 0,
  ok: 0,
  skipped: 0,
  failed: 0,
  error: null,
}

/**
 * Trimite fișierul pe loturi, secvențial: fiecare lot e o Server Action separată, așa că
 * interfața rămâne responsivă, progresul se actualizează după fiecare lot și importul se poate opri.
 */
export function useImportRunner() {
  const router = useRouter()
  const [progress, setProgress] = useState<ImportProgress>(IDLE)
  const cancelRef = useRef(false)
  const running = progress.phase === "running"

  // Avertizare la închiderea paginii în timpul importului.
  useEffect(() => {
    if (!running) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [running])

  async function start(input: {
    entity: ImportEntity
    fileName: string
    headers: string[]
    records: string[][]
    mapping: string[]
    options: ImportOptions
  }) {
    const total = countDataRows(input.records)
    cancelRef.current = false
    setProgress({ ...IDLE, phase: "running", total })

    const job = await startImport({
      entity: input.entity,
      fileName: input.fileName,
      totalRows: total,
      mapping: Object.fromEntries(
        input.headers.map((h, i) => [h.slice(0, 200), input.mapping[i] ?? ""])
      ),
      ...input.options,
    })
    if (!job.ok) {
      setProgress((p) => ({ ...p, phase: "failed", error: job.error }))
      return
    }
    const jobId = job.data.id
    setProgress((p) => ({ ...p, jobId }))

    let phase: "done" | "cancelled" | "failed" = "done"
    let error: string | null = null
    for (const batch of buildBatches(input.records, input.mapping)) {
      if (cancelRef.current) {
        phase = "cancelled"
        break
      }
      const result = await importBatch({ jobId, rows: batch })
      if (!result.ok) {
        phase = "failed"
        error = result.error
        break
      }
      setProgress((p) => ({
        ...p,
        processed: p.processed + batch.length,
        ok: p.ok + result.data.ok,
        skipped: p.skipped + result.data.skipped,
        failed: p.failed + result.data.failed,
      }))
    }

    await finishImport({ jobId, status: phase })
    setProgress((p) => ({ ...p, phase, error }))
    router.refresh()
  }

  return {
    progress,
    running,
    start,
    cancel: () => {
      cancelRef.current = true
    },
    reset: () => setProgress(IDLE),
  }
}
