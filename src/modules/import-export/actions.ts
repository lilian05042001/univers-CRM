"use server"

import { createOrgAction } from "@/lib/actions/action"
import { fail, ok } from "@/lib/actions/result"
import { createClient } from "@/lib/supabase/server"
import { getCrmOptions } from "@/modules/crm-config/queries"

import { prepareRows } from "./rows"
import { finishImportSchema, importBatchSchema, startImportSchema } from "./schemas"

export type BatchStats = { ok: number; skipped: number; failed: number }

/** Jobul de import; rândurile vin apoi pe loturi (importBatch), citite din fișier în browser. */
export const startImport = createOrgAction(
  { schema: startImportSchema, permission: "data.import" },
  async (input, ctx) => {
    if (!ctx.can("contacts.create")) return fail("errors.forbidden")
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("import_jobs")
      .insert({
        organization_id: ctx.organizationId,
        entity: input.entity,
        file_name: input.fileName,
        total_rows: input.totalRows,
        mapping: input.mapping,
        options: {
          skip_duplicates: input.skipDuplicates,
          create_companies: input.createCompanies,
          default_owner_id: input.defaultOwnerId,
        },
      })
      .select("id")
      .single()
    if (error) throw error
    return ok({ id: data.id })
  }
)

/** Un lot: validare pe server, apoi import_rows (fiecare rând în propria subtranzacție). */
export const importBatch = createOrgAction(
  { schema: importBatchSchema, permission: "data.import" },
  async ({ jobId, rows }, ctx) => {
    const supabase = await createClient()
    const { data: job, error: jobError } = await supabase
      .from("import_jobs")
      .select("entity")
      .eq("id", jobId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle()
    if (jobError) throw jobError
    if (!job) return fail("errors.forbidden")

    const entity = job.entity === "companies" ? "companies" : "contacts"
    const defs = (await getCrmOptions(ctx.organizationId)).customFields.filter(
      (d) => d.entity === (entity === "contacts" ? "contact" : "company")
    )
    const { valid, errors } = prepareRows(entity, rows, defs)
    const { data, error } = await supabase.rpc("import_rows", {
      p_job: jobId,
      p_rows: valid,
      p_errors: errors,
    })
    if (error) throw error
    return ok(data as BatchStats)
  }
)

export const finishImport = createOrgAction(
  { schema: finishImportSchema, permission: "data.import" },
  async ({ jobId, status }) => {
    const supabase = await createClient()
    const { error } = await supabase.rpc("finish_import", { p_job: jobId, p_status: status })
    if (error) throw error
    return ok()
  }
)
