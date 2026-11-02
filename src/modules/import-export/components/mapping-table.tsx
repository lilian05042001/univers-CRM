"use client"

import { useTranslations } from "next-intl"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { FieldCandidate } from "../fields"

const SKIP = "__skip__"

/** Maparea coloanelor: antetul din fișier, exemple din primele rânduri, câmpul ales. */
export function MappingTable({
  headers,
  samples,
  mapping,
  candidates,
  fieldLabel,
  onChange,
}: {
  headers: string[]
  samples: string[][]
  mapping: string[]
  candidates: FieldCandidate[]
  fieldLabel: (key: string) => string
  onChange: (mapping: string[]) => void
}) {
  const t = useTranslations("importExport.mapping")

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("column")}</TableHead>
            <TableHead className="hidden md:table-cell">{t("samples")}</TableHead>
            <TableHead className="w-64">{t("field")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {headers.map((header, index) => (
            <TableRow key={`${index}-${header}`}>
              <TableCell className="font-medium">{header}</TableCell>
              <TableCell className="hidden max-w-72 truncate text-xs text-muted-foreground md:table-cell">
                {samples
                  .map((r) => r[index]?.trim())
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </TableCell>
              <TableCell>
                <Select
                  value={mapping[index] || SKIP}
                  onValueChange={(value) =>
                    onChange(
                      mapping.map((m, i) => (i === index ? (value === SKIP ? "" : value) : m))
                    )
                  }
                >
                  <SelectTrigger className="w-full" aria-label={t("fieldFor", { column: header })}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SKIP}>{t("skip")}</SelectItem>
                    {candidates.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {fieldLabel(c.key)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
