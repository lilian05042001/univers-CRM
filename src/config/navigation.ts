import {
  BarChart3,
  Building2,
  CalendarDays,
  CheckSquare,
  Contact,
  KanbanSquare,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  Target,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react"

export type NavKey =
  | "dashboard"
  | "leads"
  | "pipeline"
  | "contacts"
  | "companies"
  | "inbox"
  | "tasks"
  | "calendar"
  | "automations"
  | "reports"
  | "team"
  | "settings"

export type NavItem = {
  key: NavKey
  href: `/${string}`
  icon: LucideIcon
  /** Etapa din docs/ROADMAP.md în care modulul devine funcțional. */
  stage: number
}

export type NavGroup = {
  key: "sales" | "communication" | "analytics" | "administration"
  items: NavItem[]
}

export const navigation: NavGroup[] = [
  {
    key: "sales",
    items: [
      { key: "dashboard", href: "/dashboard", icon: LayoutDashboard, stage: 10 },
      { key: "leads", href: "/leads", icon: Target, stage: 4 },
      { key: "pipeline", href: "/pipeline", icon: KanbanSquare, stage: 5 },
      { key: "contacts", href: "/contacts", icon: Contact, stage: 4 },
      { key: "companies", href: "/companies", icon: Building2, stage: 4 },
    ],
  },
  {
    key: "communication",
    items: [
      { key: "inbox", href: "/inbox", icon: MessagesSquare, stage: 8 },
      { key: "tasks", href: "/tasks", icon: CheckSquare, stage: 7 },
      { key: "calendar", href: "/calendar", icon: CalendarDays, stage: 7 },
    ],
  },
  {
    key: "analytics",
    items: [
      { key: "automations", href: "/automations", icon: Workflow, stage: 9 },
      { key: "reports", href: "/reports", icon: BarChart3, stage: 10 },
    ],
  },
  {
    key: "administration",
    items: [
      { key: "team", href: "/team", icon: Users, stage: 2 },
      { key: "settings", href: "/settings", icon: Settings, stage: 2 },
    ],
  },
]

export const navItems: NavItem[] = navigation.flatMap((group) => group.items)

export function getNavItem(key: NavKey): NavItem {
  const item = navItems.find((i) => i.key === key)
  if (!item) throw new Error(`Unknown nav item: ${key}`)
  return item
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
