"use server"

import { z } from "zod"

import { createOrgAction } from "@/lib/actions/action"
import { fail, ok } from "@/lib/actions/result"
import { recordRefSchema, refFields } from "@/lib/crm/record-ref"
import { createClient } from "@/lib/supabase/server"

import { FILES_BUCKET, isAllowedFile, storagePath } from "./constants"

/** Pregătește încărcarea: verifică fișierul și întoarce calea din bucket. */
export const prepareUpload = createOrgAction(
  {
    schema: z.object({
      ref: recordRefSchema,
      fileName: z.string().min(1).max(255),
      size: z.number().int().min(1),
    }),
  },
  async ({ ref, fileName, size }, ctx) => {
    if (!isAllowedFile(fileName, size)) return fail("errors.fileNotAllowed")
    return ok({ path: storagePath(ctx.organizationId, ref.entity, ref.id, fileName) })
  }
)

/** După încărcarea în Storage: înregistrează metadatele (RLS verifică vizibilitatea părintelui). */
export const registerFile = createOrgAction(
  {
    schema: z.object({
      ref: recordRefSchema,
      path: z.string().max(400),
      fileName: z.string().min(1).max(255),
      mimeType: z.string().max(100),
      size: z.number().int().min(1),
    }),
  },
  async ({ ref, path, fileName, mimeType, size }, ctx) => {
    const prefix = `${ctx.organizationId}/${ref.entity}/${ref.id}/`
    if (!path.startsWith(prefix) || path.includes("..") || !isAllowedFile(fileName, size)) {
      return fail("errors.fileNotAllowed")
    }
    const supabase = await createClient()
    const { error } = await supabase.from("files").insert({
      organization_id: ctx.organizationId,
      storage_path: path,
      file_name: fileName,
      mime_type: mimeType || "application/octet-stream",
      size_bytes: size,
      ...refFields(ref),
    })
    if (error) {
      await supabase.storage.from(FILES_BUCKET).remove([path])
      throw error
    }
    return ok()
  }
)

/** Link de descărcare valabil 60 de secunde (doar pentru fișierele vizibile). */
export const getFileUrl = createOrgAction(
  { schema: z.object({ id: z.uuid() }) },
  async ({ id }) => {
    const supabase = await createClient()
    const { data: file, error } = await supabase
      .from("files")
      .select("storage_path, file_name")
      .eq("id", id)
      .single()
    if (error) throw error
    const { data, error: urlError } = await supabase.storage
      .from(FILES_BUCKET)
      .createSignedUrl(file.storage_path, 60, { download: file.file_name })
    if (urlError) throw urlError
    return ok({ url: data.signedUrl })
  }
)

export const deleteFile = createOrgAction(
  { schema: z.object({ id: z.uuid() }) },
  async ({ id }, ctx) => {
    const supabase = await createClient()
    const { data: file, error } = await supabase
      .from("files")
      .select("storage_path")
      .eq("id", id)
      .eq("organization_id", ctx.organizationId)
      .single()
    if (error) throw error
    const { data: deleted, error: delError } = await supabase
      .from("files")
      .delete()
      .eq("id", id)
      .select("id")
    if (delError) throw delError
    if (deleted.length === 0) return fail("errors.forbidden")
    await supabase.storage.from(FILES_BUCKET).remove([file.storage_path])
    return ok()
  }
)
