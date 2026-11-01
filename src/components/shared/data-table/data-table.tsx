"use client"

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useListNavigation } from "@/hooks/use-list-navigation"

export type Column<T> = {
  id: string
  header: string
  cell: (row: T) => ReactNode
  /** Cheia de sortare pe server (parametrul `sort` din URL). */
  sortKey?: string
  className?: string
}

type DataTableProps<T> = {
  rows: T[]
  columns: Column<T>[]
  getRowId: (row: T) => string
  /** Selecție pentru acțiuni în masă; omisă = fără coloana de selecție. */
  selection?: { selected: Set<string>; onChange: (selected: Set<string>) => void }
  onRowClick?: (row: T) => void
  empty: ReactNode
}

/** Tabel generic: datele vin deja paginate/sortate/filtrate de pe server. */
export function DataTable<T>({
  rows,
  columns,
  getRowId,
  selection,
  onRowClick,
  empty,
}: DataTableProps<T>) {
  const t = useTranslations("table")
  const { searchParams, setParams, pending } = useListNavigation()
  const sort = searchParams.get("sort")
  const dir = searchParams.get("dir") ?? "desc"

  if (rows.length === 0) return <>{empty}</>

  const ids = rows.map(getRowId)
  const allSelected = selection ? ids.every((id) => selection.selected.has(id)) : false
  const someSelected = selection ? ids.some((id) => selection.selected.has(id)) : false

  function toggleAll() {
    if (!selection) return
    selection.onChange(allSelected ? new Set() : new Set(ids))
  }

  function toggle(id: string) {
    if (!selection) return
    const next = new Set(selection.selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selection.onChange(next)
  }

  function sortBy(key: string) {
    const nextDir = sort === key && dir === "desc" ? "asc" : "desc"
    setParams({ sort: key, dir: nextDir })
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card" aria-busy={pending}>
      <Table className={pending ? "opacity-60 transition-opacity" : undefined}>
        <TableHeader>
          <TableRow>
            {selection && (
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label={t("selectAll")}
                />
              </TableHead>
            )}
            {columns.map((col) => (
              <TableHead key={col.id} className={col.className}>
                {col.sortKey ? (
                  <button
                    type="button"
                    onClick={() => sortBy(col.sortKey!)}
                    className="-ml-1 inline-flex items-center gap-1 rounded px-1 hover:text-foreground"
                  >
                    {col.header}
                    {sort === col.sortKey ? (
                      dir === "asc" ? (
                        <ArrowUp className="size-3.5" />
                      ) : (
                        <ArrowDown className="size-3.5" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3.5 opacity-40" />
                    )}
                  </button>
                ) : (
                  col.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const id = getRowId(row)
            const selected = selection?.selected.has(id) ?? false
            return (
              <TableRow
                key={id}
                data-state={selected ? "selected" : undefined}
                className={onRowClick ? "cursor-pointer" : undefined}
                onClick={() => onRowClick?.(row)}
              >
                {selection && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => toggle(id)}
                      aria-label={t("selectRow")}
                    />
                  </TableCell>
                )}
                {columns.map((col) => (
                  <TableCell key={col.id} className={col.className}>
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
