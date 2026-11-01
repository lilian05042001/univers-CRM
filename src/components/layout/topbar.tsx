import { useTranslations } from "next-intl"
import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { SidebarTrigger } from "@/components/ui/sidebar"

import { GlobalSearch } from "./global-search"
import { NotificationBellSlot } from "./notification-bell-slot"
import { UserMenu } from "./user-menu"

export function Topbar() {
  const t = useTranslations("topbar")

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-card/95 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="-ml-1" aria-label={t("toggleSidebar")} />
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1">
        <Suspense fallback={<Skeleton className="size-8 rounded-md" />}>
          <NotificationBellSlot />
        </Suspense>
        <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
          <UserMenu />
        </Suspense>
      </div>
    </header>
  )
}
