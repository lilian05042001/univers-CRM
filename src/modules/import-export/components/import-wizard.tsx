"use client"

import { Upload } from "lucide-react"
import { useTranslations } from "next-intl"
import Papa from "papaparse"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CustomFieldDef, NamedOption } from "@/modules/crm-config/types"

import { countDataRows, toParsedCsv, type ParsedCsv } from "../batches"
import {
  autoMap,
  CUSTOM_PREFIX,
  IMPORT_ENTITIES,
  IMPORT_LIMITS,
  importCandidates,
  mappingError,
  type ImportEntity,
} from "../fields"
import { useImportRunner } from "../hooks/use-import-runner"

import { ImportProgressPanel } from "./import-progress"
import { MappingTable } from "./mapping-table"

const ENCODINGS = ["utf-8", "windows-1250", "windows-1251"] as const
const NONE = "__none__"

/** Importul CSV: fișier → mapare coloane → opțiuni → trimitere pe loturi, cu progres. */
export function ImportWizard({
  members,
  customFields,
  currentUserId,
}: {
  members: NamedOption[]
  customFields: CustomFieldDef[]
  currentUserId: string
}) {
  const t = useTranslations("importExport")
  const tRoot = useTranslations()
  const runner = useImportRunner()
  const [entity, setEntity] = useState<ImportEntity>("contacts")
  const [encoding, setEncoding] = useState<(typeof ENCODINGS)[number]>("utf-8")
  const [source, setSource] = useState<File | null>(null)
  const [file, setFile] = useState<{ name: string; csv: ParsedCsv } | null>(null)
  const [mapping, setMapping] = useState<string[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [createCompanies, setCreateCompanies] = useState(true)
  const [ownerId, setOwnerId] = useState<string>(currentUserId)

  const defsFor = (e: ImportEntity) =>
    customFields.filter((d) => d.entity === (e === "contacts" ? "contact" : "company"))
  const labelFor = (e: ImportEntity) => (key: string) => {
    if (key.startsWith(CUSTOM_PREFIX))
      return defsFor(e).find((d) => `${CUSTOM_PREFIX}${d.key}` === key)?.label ?? key
    return t(e === "companies" && key === "name" ? "fields.companyName" : `fields.${key}`)
  }
  const candidatesFor = (e: ImportEntity) => importCandidates(e, labelFor(e), defsFor(e))
  const candidates = candidatesFor(entity)
  const error = file ? mappingError(entity, mapping) : null
  const rows = file ? countDataRows(file.csv.records) : 0

  function changeEntity(next: ImportEntity) {
    setEntity(next)
    if (file) setMapping(autoMap(file.csv.headers, candidatesFor(next)))
  }

  function load(selected: File | null | undefined, nextEncoding = encoding) {
    setFileError(null)
    setFile(null)
    setSource(selected ?? null)
    if (!selected) return
    if (selected.size > IMPORT_LIMITS.maxFileBytes)
      return setFileError("importExport.file.tooLarge")
    Papa.parse<string[]>(selected, {
      encoding: nextEncoding,
      skipEmptyLines: true,
      complete: (result) => {
        const csv = toParsedCsv(result.data)
        const count = countDataRows(csv.records)
        if (count === 0) return setFileError("importExport.file.empty")
        if (count > IMPORT_LIMITS.maxRows) return setFileError("importExport.file.tooManyRows")
        setMapping(autoMap(csv.headers, candidatesFor(entity)))
        setFile({ name: selected.name, csv })
      },
      error: () => setFileError("importExport.file.unreadable"),
    })
  }

  if (runner.progress.phase !== "idle") {
    return (
      <ImportProgressPanel
        progress={runner.progress}
        onCancel={runner.cancel}
        onReset={() => {
          runner.reset()
          load(null)
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="import-entity">{t("entity")}</FieldLabel>
          <Select value={entity} onValueChange={(v) => changeEntity(v as ImportEntity)}>
            <SelectTrigger id="import-entity" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMPORT_ENTITIES.map((e) => (
                <SelectItem key={e} value={e}>
                  {t(`entities.${e}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="import-encoding">{t("encoding")}</FieldLabel>
          <Select
            value={encoding}
            onValueChange={(v) => {
              const next = v as (typeof ENCODINGS)[number]
              setEncoding(next)
              if (source) load(source, next)
            }}
          >
            <SelectTrigger id="import-encoding" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENCODINGS.map((e) => (
                <SelectItem key={e} value={e}>
                  {t(`encodings.${e}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="import-file">{t("file.label")}</FieldLabel>
          <Input
            id="import-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => load(e.target.files?.[0])}
          />
          <FieldDescription>
            {fileError ? (
              <span className="text-destructive">{tRoot(fileError)}</span>
            ) : (
              t("file.hint", { rows: IMPORT_LIMITS.maxRows })
            )}
          </FieldDescription>
        </Field>
      </div>

      {file && (
        <>
          <p className="text-sm text-muted-foreground">
            {t("file.summary", { name: file.name, rows, columns: file.csv.headers.length })}
          </p>
          <MappingTable
            headers={file.csv.headers}
            samples={file.csv.records.slice(0, 3)}
            mapping={mapping}
            candidates={candidates}
            fieldLabel={labelFor(entity)}
            onChange={setMapping}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Field orientation="horizontal">
                <Checkbox
                  id="import-skip-duplicates"
                  checked={skipDuplicates}
                  onCheckedChange={(v) => setSkipDuplicates(v === true)}
                />
                <FieldLabel htmlFor="import-skip-duplicates" className="font-normal">
                  {t(`options.skipDuplicates.${entity}`)}
                </FieldLabel>
              </Field>
              {entity === "contacts" && (
                <Field orientation="horizontal">
                  <Checkbox
                    id="import-create-companies"
                    checked={createCompanies}
                    onCheckedChange={(v) => setCreateCompanies(v === true)}
                  />
                  <FieldLabel htmlFor="import-create-companies" className="font-normal">
                    {t("options.createCompanies")}
                  </FieldLabel>
                </Field>
              )}
            </div>
            <Field>
              <FieldLabel htmlFor="import-owner">{t("options.defaultOwner")}</FieldLabel>
              <Select
                value={ownerId || NONE}
                onValueChange={(v) => setOwnerId(v === NONE ? "" : v)}
              >
                <SelectTrigger id="import-owner" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("options.noOwner")}</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>{t("options.defaultOwnerHint")}</FieldDescription>
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={error !== null}
              onClick={() =>
                runner.start({
                  entity,
                  fileName: file.name,
                  headers: file.csv.headers,
                  records: file.csv.records,
                  mapping,
                  options: {
                    skipDuplicates,
                    createCompanies: entity === "contacts" && createCompanies,
                    defaultOwnerId: ownerId || null,
                  },
                })
              }
            >
              <Upload />
              {t("start", { rows })}
            </Button>
            {error && <span className="text-sm text-destructive">{tRoot(error)}</span>}
          </div>
        </>
      )}
    </div>
  )
}
