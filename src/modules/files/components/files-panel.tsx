"use client"

import { Download, Paperclip, Trash2, Upload } from "lucide-react"
import { useFormatter, useTranslations } from "next-intl"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import type { RecordRef } from "@/lib/crm/record-ref"
import { getBrowserClient } from "@/lib/supabase/client"
import type { FileItem } from "@/modules/activity/queries"

import { deleteFile, getFileUrl, prepareUpload, registerFile } from "../actions"
import { FILES_BUCKET } from "../constants"

export function FilesPanel({
  recordRef,
  files,
  currentUserId,
  isAdmin,
  memberName,
}: {
  recordRef: RecordRef
  files: FileItem[]
  currentUserId: string
  isAdmin: boolean
  memberName: (id: string | null | undefined) => string | undefined
}) {
  const t = useTranslations("files")
  const tAll = useTranslations()
  const format = useFormatter()
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const { run, pending } = useActionRunner()

  async function upload(list: FileList | null) {
    if (!list?.length) return
    setUploading(true)
    const supabase = getBrowserClient()
    for (const file of Array.from(list)) {
      const prepared = await prepareUpload({ ref: recordRef, fileName: file.name, size: file.size })
      if (!prepared.ok) {
        toast.error(`${file.name}: ${tAll(prepared.error)}`)
        continue
      }
      const { error } = await supabase.storage
        .from(FILES_BUCKET)
        .upload(prepared.data.path, file, { contentType: file.type || undefined })
      if (error) {
        toast.error(`${file.name}: ${t("uploadFailed")}`)
        continue
      }
      const registered = await registerFile({
        ref: recordRef,
        path: prepared.data.path,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
      })
      if (registered.ok) toast.success(t("uploaded", { name: file.name }))
      else toast.error(`${file.name}: ${tAll(registered.error)}`)
    }
    setUploading(false)
    if (input.current) input.current.value = ""
    router.refresh()
  }

  async function download(id: string) {
    const result = await getFileUrl({ id })
    if (result.ok) window.location.assign(result.data.url)
    else toast.error(tAll(result.error))
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <input
          ref={input}
          type="file"
          multiple
          className="sr-only"
          id={`files-${recordRef.id}`}
          onChange={(e) => upload(e.target.files)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          {uploading ? <Spinner /> : <Upload />}
          {t("upload")}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">{t("limits")}</p>
      </div>

      {files.length === 0 ? (
        <EmptyState icon={Paperclip} title={t("emptyTitle")} />
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-3 py-2.5">
              <Paperclip className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {format.number(file.sizeBytes / 1024, { maximumFractionDigits: 0 })} KB ·{" "}
                  {memberName(file.createdBy) ?? "—"} ·{" "}
                  {format.dateTime(new Date(file.createdAt), { dateStyle: "medium" })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("download")}
                onClick={() => download(file.id)}
              >
                <Download />
              </Button>
              {(file.createdBy === currentUserId || isAdmin) && (
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
                  description={t("deleteDescription", { name: file.fileName })}
                  confirmLabel={t("delete")}
                  onConfirm={() => run(() => deleteFile({ id: file.id }), "files.deleted")}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
