export const NOTIFICATION_TYPES = [
  "task_due_soon",
  "task_overdue",
  "task_assigned",
  "lead_assigned",
  "conversation_assigned",
  "message_received",
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]
