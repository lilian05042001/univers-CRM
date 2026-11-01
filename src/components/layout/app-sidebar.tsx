"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { Orbit } from "lucide-react"
import { Suspense, type ReactNode } from "react"

import { isActivePath, navigation } from "@/config/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"

/** `footer` primește comutatorul de organizație (randat pe server, în Suspense). */
export function AppSidebar({ footer }: { footer: ReactNode }) {
  const tApp = useTranslations("app")

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-1 font-semibold text-sidebar-accent-foreground"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary">
            <Orbit className="size-5" />
          </span>
          <span className="truncate group-data-[collapsible=icon]:hidden">{tApp("name")}</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Pe rutele dinamice adresa e dată de cerere: meniul apare imediat, evidențierea după. */}
        <Suspense fallback={<NavLinks pathname={null} />}>
          <ActiveNavLinks />
        </Suspense>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />
}

function NavLinks({ pathname }: { pathname: string | null }) {
  const t = useTranslations("nav")
  const { isMobile, setOpenMobile } = useSidebar()

  return navigation.map((group) => (
    <SidebarGroup key={group.key}>
      <SidebarGroupLabel className="text-sidebar-foreground/60">
        {t(`groups.${group.key}`)}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => {
            const label = t(item.key)
            return (
              <SidebarMenuItem key={item.key}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname !== null && isActivePath(pathname, item.href)}
                  tooltip={label}
                  className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                >
                  <Link href={item.href} onClick={() => isMobile && setOpenMobile(false)}>
                    <item.icon />
                    <span>{label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ))
}
