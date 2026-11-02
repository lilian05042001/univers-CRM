"use server"

import { randomUUID } from "node:crypto"

import { z } from "zod"

import { createOrgAction } from "@/lib/actions/action"
import { fail, ok } from "@/lib/actions/result"
import { syncTags } from "@/lib/crm/records"
import { createClient } from "@/lib/supabase/server"
import { emptyToNull } from "@/lib/utils/format"
import { getCrmOptions } from "@/modules/crm-config/queries"
import { FILES_BUCKET, isAllowedFile, storagePath } from "@/modules/files/constants"

import {
  assignConversationSchema,
  conversationStatusSchema,
  conversationTagsSchema,
  createLeadFromConversationSchema,
  linkLeadSchema,
  prepareAttachmentSchema,
  sendMessageSchema,
  startConversationSchema,
} from "./schemas"

const attachmentPrefix = (organizationId: string, conversationId: string) =>
  `${organizationId}/conversation/${conversationId}/`

/** Calea din bucket pentru un atașament (încărcat din browser înainte de trimiterea mesajului). */
export const prepareAttachment = createOrgAction(
  { schema: prepareAttachmentSchema },
  async ({ conversationId, fileName, size }, ctx) => {
    if (!isAllowedFile(fileName, size)) return fail("errors.fileNotAllowed")
    return ok({ path: storagePath(ctx.organizationId, "conversation", conversationId, fileName) })
  }
)

/** Răspuns, mesaj primit (doar canal intern, verificat în DB) sau notă internă, cu atașamente. */
export const sendMessage = createOrgAction({ schema: sendMessageSchema }, async (input, ctx) => {
  const { conversationId, mode, body, attachments } = input
  if (!body && (mode === "note" || attachments.length === 0)) {
    return fail("errors.validation", { body: "validation.required" })
  }
  const prefix = attachmentPrefix(ctx.organizationId, conversationId)
  if (
    attachments.some(
      (a) =>
        !a.path.startsWith(prefix) || a.path.includes("..") || !isAllowedFile(a.fileName, a.size)
    )
  ) {
    return fail("errors.fileNotAllowed")
  }

  const supabase = await createClient()
  const removeUploads = () =>
    attachments.length
      ? supabase.storage.from(FILES_BUCKET).remove(attachments.map((a) => a.path))
      : Promise.resolve()

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      organization_id: ctx.organizationId,
      conversation_id: conversationId,
      kind: mode === "note" ? "internal_note" : "message",
      direction: mode === "inbound" ? "in" : "out",
      body,
      content_type: body ? "text" : "attachment",
    })
    .select("id")
    .single()
  if (error) {
    await removeUploads()
    throw error
  }

  if (attachments.length) {
    const { error: filesError } = await supabase.from("files").insert(
      attachments.map((a) => ({
        organization_id: ctx.organizationId,
        message_id: message.id,
        storage_path: a.path,
        file_name: a.fileName,
        mime_type: a.mimeType || "application/octet-stream",
        size_bytes: a.size,
      }))
    )
    if (filesError) {
      await removeUploads()
      throw filesError
    }
  }
  return ok({ id: message.id })
})

export const markConversationRead = createOrgAction(
  { schema: z.object({ id: z.uuid() }) },
  async ({ id }) => {
    const supabase = await createClient()
    const { error } = await supabase.rpc("mark_conversation_read", { p_conversation: id })
    if (error) throw error
    return ok()
  }
)

/** Preluare (sie) sau atribuire altui coleg (inbox.assign; verificat și în public.assign_conversation). */
export const assignConversation = createOrgAction(
  { schema: assignConversationSchema },
  async ({ id, assigneeId }, ctx) => {
    if (assigneeId && assigneeId !== ctx.user.id && !ctx.can("inbox.assign")) {
      return fail("errors.db.assign_forbidden")
    }
    const supabase = await createClient()
    const { error } = await supabase.rpc("assign_conversation", {
      p_conversation: id,
      p_assignee: assigneeId ?? undefined,
    })
    if (error) throw error
    return ok()
  }
)

export const setConversationStatus = createOrgAction(
  { schema: conversationStatusSchema },
  async ({ id, status }, ctx) => updateConversation(id, ctx.organizationId, { status })
)

export const linkConversationLead = createOrgAction(
  { schema: linkLeadSchema },
  async ({ id, leadId }, ctx) => updateConversation(id, ctx.organizationId, { lead_id: leadId })
)

export const setConversationTags = createOrgAction(
  { schema: conversationTagsSchema },
  async ({ id, tagIds }, ctx) => {
    await syncTags("conversation_tags", "conversation_id", ctx.organizationId, id, tagIds)
    return ok()
  }
)

async function updateConversation(
  id: string,
  organizationId: string,
  fields: { status?: string; lead_id?: string | null }
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("conversations")
    .update(fields)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .select("id")
  if (error) throw error
  // RLS ascunde conversațiile invizibile: nicio linie actualizată = fără drept.
  return data.length ? ok() : fail("errors.forbidden")
}

/** Lead nou din conversație: pipeline-ul implicit, prima etapă, contactul conversației. */
export const createLeadFromConversation = createOrgAction(
  { schema: createLeadFromConversationSchema, permission: "leads.create" },
  async ({ conversationId, title }, ctx) => {
    const supabase = await createClient()
    const { data: conversation, error } = await supabase
      .from("conversations")
      .select("id, contact_id")
      .eq("id", conversationId)
      .single()
    if (error) throw error

    const options = await getCrmOptions(ctx.organizationId)
    const pipeline = options.pipelines.find((p) => p.isDefault) ?? options.pipelines[0]
    const stage = pipeline?.stages.find((s) => s.kind === "open")
    if (!pipeline || !stage) return fail("errors.unexpected")

    const id = randomUUID()
    const { error: leadError } = await supabase.from("leads").insert({
      id,
      organization_id: ctx.organizationId,
      title,
      pipeline_id: pipeline.id,
      stage_id: stage.id,
      currency: ctx.membership.organization.currency,
      responsible_id: ctx.user.id,
    })
    if (leadError) throw leadError

    if (conversation.contact_id) {
      const { error: linkError } = await supabase.from("lead_contacts").insert({
        organization_id: ctx.organizationId,
        lead_id: id,
        contact_id: conversation.contact_id,
        is_primary: true,
      })
      if (linkError) throw linkError
    }
    const result = await updateConversation(conversationId, ctx.organizationId, { lead_id: id })
    return result.ok ? ok({ id }) : result
  }
)

/** Conversație nouă pe canalul intern, cu un contact existent, atribuită autorului. */
export const startConversation = createOrgAction(
  { schema: startConversationSchema },
  async ({ contactId, subject }, ctx) => {
    if (!contactId) return fail("errors.validation", { contactId: "validation.required" })
    const supabase = await createClient()
    const [{ data: channel, error: channelError }, { data: contact, error: contactError }] =
      await Promise.all([
        supabase
          .from("channels")
          .select("id")
          .eq("organization_id", ctx.organizationId)
          .eq("provider", "internal")
          .single(),
        supabase.from("contacts").select("id, full_name").eq("id", contactId).single(),
      ])
    if (channelError) throw channelError
    if (contactError) throw contactError

    const id = randomUUID()
    const { error } = await supabase.from("conversations").insert({
      id,
      organization_id: ctx.organizationId,
      channel_id: channel.id,
      contact_id: contact.id,
      assignee_id: ctx.user.id,
      subject: emptyToNull(subject),
      display_name: contact.full_name ?? "",
    })
    if (error) throw error
    return ok({ id })
  }
)
