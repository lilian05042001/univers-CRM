import { z } from "zod"

export const CONVERSATION_STATUSES = ["open", "pending", "closed"] as const
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number]

/** Filtrele listei din Inbox (în URL). */
export const STATUS_FILTERS = ["open", "pending", "closed", "all"] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]
export const ASSIGNMENT_FILTERS = ["all", "mine", "unassigned"] as const
export type AssignmentFilter = (typeof ASSIGNMENT_FILTERS)[number]

/** Răspuns către client · mesaj primit înregistrat manual (canal intern) · notă internă. */
export const MESSAGE_MODES = ["reply", "inbound", "note"] as const
export type MessageMode = (typeof MESSAGE_MODES)[number]

export const MAX_ATTACHMENTS = 10

export const attachmentSchema = z.object({
  path: z.string().max(400),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(100),
  size: z.number().int().min(1),
})
export type AttachmentInput = z.infer<typeof attachmentSchema>

export const sendMessageSchema = z.object({
  conversationId: z.uuid(),
  mode: z.enum(MESSAGE_MODES),
  body: z.string().trim().max(10000, { error: "validation.tooLong" }),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS),
})

export const prepareAttachmentSchema = z.object({
  conversationId: z.uuid(),
  fileName: z.string().min(1).max(255),
  size: z.number().int().min(1),
})

export const startConversationSchema = z.object({
  contactId: z.uuid({ error: "validation.required" }).nullable(),
  subject: z.string().trim().max(200, { error: "validation.tooLong" }),
})
export type StartConversationInput = z.input<typeof startConversationSchema>

export const assignConversationSchema = z.object({
  id: z.uuid(),
  assigneeId: z.uuid().nullable(),
})

export const conversationStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(CONVERSATION_STATUSES),
})

export const conversationTagsSchema = z.object({
  id: z.uuid(),
  tagIds: z.array(z.uuid()).max(50),
})

export const linkLeadSchema = z.object({
  id: z.uuid(),
  leadId: z.uuid().nullable(),
})

export const createLeadFromConversationSchema = z.object({
  conversationId: z.uuid(),
  title: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(200, { error: "validation.tooLong" }),
})
export type CreateLeadFromConversationInput = z.input<typeof createLeadFromConversationSchema>

export const quickReplySchema = z.object({
  id: z.uuid().optional(),
  title: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(100, { error: "validation.tooLong" }),
  shortcut: z
    .string()
    .trim()
    .regex(/^[a-z0-9_-]{0,30}$/, { error: "validation.shortcut" }),
  body: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(5000, { error: "validation.tooLong" }),
  /** Partajat cu toată organizația (doar cu settings.manage) sau personal. */
  shared: z.boolean(),
})
export type QuickReplyInput = z.input<typeof quickReplySchema>

export const channelSchema = z.object({
  id: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, { error: "validation.required" })
    .max(100, { error: "validation.tooLong" }),
})
export type ChannelInput = z.input<typeof channelSchema>
