import { Suspense } from "react"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { OrgSwitcherSlot } from "@/components/layout/org-switcher-slot"
import { Topbar } from "@/components/layout/topbar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <AppSidebar
        footer={
          <Suspense fallback={<Skeleton className="h-12 w-full bg-sidebar-accent" />}>
            <OrgSwitcherSlot />
          </Suspense>
        }
      />
      <SidebarInset className="min-w-0">
        <Topbar />
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
