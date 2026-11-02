"use client"

import { Building2, Plus, Tag, Trash2, UserRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { BulkBar } from "@/components/shared/data-table/bulk-bar"
import { BulkMenu } from "@/components/shared/data-table/bulk-menu"
import { DataTable, type Column } from "@/components/shared/data-table/data-table"
import { ExportButton } from "@/components/shared/data-table/export-button"
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

import { assignCompanies, deleteCompanies, tagCompanies } from "../actions"
import type { CompanyRecord, CompanyRow } from "../queries"

import { CompanyFormDialog } from "./company-form-dialog"

type Props = {
  rows: CompanyRow[]
  total: number
  page: number
  pageSize: number
  options: CrmOptions
  record: CompanyRecord | null
  isNew: boolean
  can: { create: boolean; edit: boolean; delete: boolean; export: boolean }
}

export function CompaniesView({ rows, total, page, pageSize, options, record, isNew, can }: Props) {
  const t = useTranslations("companies")
  const { setParams } = useListNavigation()
  const { run, pending } = useActionRunner()
  const routeDialog = useRouteDialog()
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const memberName = nameById(options.members)
  const ids = [...selected]
  const bulkDone = () => setSelected(new Set())

  const columns: Column<CompanyRow>[] = [
    {
      id: "name",
      header: t("columns.name"),
      sortKey: "name",
      cell: (c) => (
        <div className="min-w-40">
          <p className="font-medium">{c.name}</p>
          {c.industry && <p className="text-xs text-muted-foreground">{c.industry}</p>}
        </div>
      ),
    },
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
      id: "contacts",
      header: t("columns.contacts"),
      className: "text-center",
      cell: (c) =>
        c.contactCount > 0 ? (
          <Link
            href={`/contacts?company=${c.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-primary hover:underline"
          >
            {c.contactCount}
          </Link>
        ) : (
          0
        ),
    },
    {
      id: "leads",
      header: t("columns.leads"),
      className: "text-center",
      cell: (c) =>
        c.leadCount > 0 ? (
          <Link
            href={`/leads?company=${c.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-primary hover:underline"
          >
            {c.leadCount}
          </Link>
        ) : (
          0
        ),
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
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Toolbar filterKeys={["owner", "tag"]}>
          <FilterSelect
            param="owner"
            label={t("filters.owner")}
            options={[
              { value: "none", label: t("unassigned") },
              ...options.members.map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
          <FilterSelect
            param="tag"
            label={t("filters.tag")}
            options={options.tags.map((s) => ({ value: s.id, label: s.name }))}
          />
        </Toolbar>
        {can.export && <ExportButton />}
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
              run(() => assignCompanies({ ids, ownerId }), "companies.bulk.assigned", bulkDone)
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
              tagId && run(() => tagCompanies({ ids, tagId }), "companies.bulk.tagged", bulkDone)
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
            onConfirm={() =>
              run(() => deleteCompanies({ ids }), "companies.bulk.deleted", bulkDone)
            }
          />
        )}
      </BulkBar>

      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(c) => c.id}
        selection={can.edit || can.delete ? { selected, onChange: setSelected } : undefined}
        onRowClick={(c) => router.push(`/companies/${c.id}`)}
        empty={
          <EmptyState
            icon={Building2}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
        }
      />
      {total > 0 && <Pagination total={total} page={page} pageSize={pageSize} />}

      {routeDialog.openParam && (isNew || record) && (
        <CompanyFormDialog
          key={record?.id ?? "new"}
          record={record}
          options={options}
          onClose={routeDialog.close}
        />
      )}
    </div>
  )
}
