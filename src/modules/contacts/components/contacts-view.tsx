"use client"

import { Contact, Plus, Tag, Trash2, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { BulkBar } from "@/components/shared/data-table/bulk-bar"
import { BulkMenu } from "@/components/shared/data-table/bulk-menu"
import { DataTable, type Column } from "@/components/shared/data-table/data-table"
import { Pagination } from "@/components/shared/data-table/pagination"
import { FilterSelect, Toolbar } from "@/components/shared/data-table/toolbar"
import { EmptyState } from "@/components/shared/empty-state"
import { TagBadge } from "@/components/shared/tag-badge"
import { Button } from "@/components/ui/button"
import { useListNavigation } from "@/hooks/use-list-navigation"
import { useRouteDialog } from "@/hooks/use-route-dialog"
import { useActionRunner } from "@/lib/actions/use-action-runner"
import { formatPhone } from "@/lib/utils/phone"
import { nameById } from "@/modules/crm-config/options"
import type { CrmOptions } from "@/modules/crm-config/types"

import { assignContacts, deleteContacts, tagContacts } from "../actions"
import type { ContactRecord, ContactRow } from "../queries"

import { ContactFormDialog } from "./contact-form-dialog"

type Props = {
  rows: ContactRow[]
  total: number
  page: number
  pageSize: number
  options: CrmOptions
  record: ContactRecord | null
  isNew: boolean
  can: { create: boolean; edit: boolean; delete: boolean }
}

export function ContactsView({ rows, total, page, pageSize, options, record, isNew, can }: Props) {
  const t = useTranslations("contacts")
  const format = useFormatter()
  const { setParams } = useListNavigation()
  const { run, pending } = useActionRunner()
  const routeDialog = useRouteDialog()
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const memberName = nameById(options.members)
  const ids = [...selected]

  const columns: Column<ContactRow>[] = [
    {
      id: "name",
      header: t("columns.name"),
      sortKey: "full_name",
      cell: (c) => (
        <div className="min-w-40">
          <p className="font-medium">{c.name}</p>
          {c.position && <p className="text-xs text-muted-foreground">{c.position}</p>}
        </div>
      ),
    },
    { id: "company", header: t("columns.company"), cell: (c) => c.company?.name ?? "—" },
    {
      id: "phone",
      header: t("columns.phone"),
      cell: (c) =>
        c.phone ? <span className="whitespace-nowrap">{formatPhone(c.phone)}</span> : "—",
    },
    {
      id: "email",
      header: t("columns.email"),
      cell: (c) => c.email ?? "—",
      className: "hidden lg:table-cell",
    },
    {
      id: "owner",
      header: t("columns.owner"),
      cell: (c) => memberName(c.ownerId) ?? t("unassigned"),
    },
    {
      id: "tags",
      header: t("columns.tags"),
      className: "hidden xl:table-cell",
      cell: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.tags.map((tag) => (
            <TagBadge key={tag.id} name={tag.name} color={tag.color} />
          ))}
        </div>
      ),
    },
    {
      id: "created",
      header: t("columns.created"),
      sortKey: "created_at",
      className: "hidden md:table-cell whitespace-nowrap",
      cell: (c) => format.dateTime(new Date(c.createdAt), { dateStyle: "medium" }),
    },
  ]

  const bulkDone = () => setSelected(new Set())

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Toolbar filterKeys={["owner", "source", "tag"]}>
          <FilterSelect
            param="owner"
            label={t("filters.owner")}
            options={[
              { value: "none", label: t("unassigned") },
              ...options.members.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
          <FilterSelect
            param="source"
            label={t("filters.source")}
            options={options.sources.map((s) => ({ value: s.id, label: s.name }))}
          />
          <FilterSelect
            param="tag"
            label={t("filters.tag")}
            options={options.tags.map((s) => ({ value: s.id, label: s.name }))}
          />
        </Toolbar>
        {can.create && (
          <Button onClick={() => setParams({ open: "new" }, { resetPage: false })}>
            <Plus />
            {t("create")}
          </Button>
        )}
      </div>

      <BulkBar count={selected.size} onClear={bulkDone}>
        {can.edit && (
          <BulkMenu
            label={t("bulk.assign")}
            icon={UserRound}
            disabled={pending}
            options={[
              { value: null, label: t("unassigned") },
              ...options.members.map((m) => ({ value: m.id, label: m.name })),
            ]}
            onPick={(ownerId) =>
              run(() => assignContacts({ ids, ownerId }), "contacts.bulk.assigned", bulkDone)
            }
          />
        )}
        {can.edit && options.tags.length > 0 && (
          <BulkMenu
            label={t("bulk.tag")}
            icon={Tag}
            disabled={pending}
            options={options.tags.map((tag) => ({ value: tag.id, label: tag.name }))}
            onPick={(tagId) =>
              tagId && run(() => tagContacts({ ids, tagId }), "contacts.bulk.tagged", bulkDone)
            }
          />
        )}
        {can.delete && (
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm" disabled={pending}>
                <Trash2 />
                {t("bulk.delete")}
              </Button>
            }
            title={t("bulk.deleteTitle")}
            description={t("bulk.deleteDescription", { count: selected.size })}
            confirmLabel={t("bulk.delete")}
            onConfirm={() => run(() => deleteContacts({ ids }), "contacts.bulk.deleted", bulkDone)}
          />
        )}
      </BulkBar>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(c) => c.id}
        selection={can.edit || can.delete ? { selected, onChange: setSelected } : undefined}
        onRowClick={(c) => router.push(`/contacts/${c.id}`)}
        empty={
          <EmptyState icon={Contact} title={t("emptyTitle")} description={t("emptyDescription")} />
        }
      />
      {total > 0 && <Pagination total={total} page={page} pageSize={pageSize} />}

      {routeDialog.openParam && (isNew || record) && (
        <ContactFormDialog
          key={record?.id ?? "new"}
          record={record}
          options={options}
          canMerge={can.edit && can.delete}
          onClose={routeDialog.close}
        />
      )}
    </div>
  )
}
