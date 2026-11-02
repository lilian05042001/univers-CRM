import {
  Bell,
  Building2,
  FileUp,
  KeyRound,
  ListChecks,
  MessagesSquare,
  Plug,
  Shapes,
  ShieldCheck,
  Tags,
  Target,
  UsersRound,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react"

export type SettingsSection = {
  key: string
  icon: LucideIcon
  /** Ruta, dacă secțiunea e deja implementată. */
  href?: `/${string}`
  /** Etapa din docs/ROADMAP.md în care devine disponibilă. */
  stage: number
}

export const settingsSections: SettingsSection[] = [
  { key: "company", icon: Building2, href: "/settings/company", stage: 2 },
  { key: "users", icon: UsersRound, href: "/team", stage: 2 },
  { key: "roles", icon: ShieldCheck, href: "/settings/roles", stage: 2 },
  { key: "pipelines", icon: Workflow, href: "/settings/pipelines", stage: 5 },
  { key: "tags", icon: Tags, href: "/settings/tags", stage: 4 },
  { key: "fields", icon: Shapes, href: "/settings/fields", stage: 4 },
  { key: "sources", icon: Target, href: "/settings/sources", stage: 4 },
  { key: "taskTypes", icon: ListChecks, href: "/settings/task-types", stage: 7 },
  { key: "notifications", icon: Bell, href: "/settings/notifications", stage: 7 },
  { key: "channels", icon: MessagesSquare, href: "/settings/channels", stage: 8 },
  { key: "quickReplies", icon: Zap, href: "/settings/quick-replies", stage: 8 },
  { key: "integrations", icon: Plug, stage: 11 },
  { key: "api", icon: KeyRound, stage: 11 },
  { key: "importExport", icon: FileUp, stage: 11 },
]
