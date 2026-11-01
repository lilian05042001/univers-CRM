"use client"

import { ArrowLeft, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { useListNavigation } from "@/hooks/use-list-navigation"
import type { ActionResult } from "@/lib/actions/result"
import { useActionRunner } from "@/lib/actions/use-action-runner"

/** Antetul fișelor de contact / companie: înapoi, titlu, editare (`?open=edit`), ștergere. */
export function RecordHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  canEdit,
  canDelete,
  onDelete,
  deleteDescription,
}: {
  backHref: string
  backLabel: string
  title: string
  subtitle?: ReactNode
  canEdit: boolean
  canDelete: boolean
  onDelete: () => Promise<ActionResult<unknown>>
  deleteDescription: string
}) {
  const t = useTranslations("detail")
  const router = useRouter()
  const { setParams } = useListNavigation()
  const { run, pending } = useActionRunner()

  return (
    <div className="mb-6 flex flex-col gap-4">
      <Link
        href={backHref}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => setParams({ open: "edit" }, { resetPage: false })}
            >
              <Pencil />
              {t("edit")}
            </Button>
          )}
          {canDelete && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon" aria-label={t("delete")} disabled={pending}>
                  <Trash2 />
                </Button>
              }
              title={t("deleteTitle")}
              description={deleteDescription}
              confirmLabel={t("delete")}
              onConfirm={() => run(onDelete, "detail.deleted", () => router.push(backHref))}
            />
          )}
        </div>
      </div>
    </div>
  )
}
