"use client"

import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { useTransition } from "react"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

import { switchOrganization } from "../actions"
import { enterOrganization } from "../enter-organization"

type OrgOption = { id: string; name: string; roleName: string }

export function OrgSwitcher({
  activeId,
  organizations,
}: {
  activeId: string
  organizations: OrgOption[]
}) {
  const t = useTranslations("organizations")
  const tErrors = useTranslations()
  const [pending, startTransition] = useTransition()
  const active = organizations.find((o) => o.id === activeId) ?? organizations[0]

  function select(organizationId: string) {
    if (organizationId === activeId) return
    startTransition(async () => {
      const result = await switchOrganization({ organizationId })
      if (!result.ok) {
        toast.error(tErrors(result.error))
        return
      }
      enterOrganization()
    })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              disabled={pending}
              tooltip={active.name}
              className="data-[state=open]:bg-sidebar-accent"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2 className="size-4" />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate font-semibold text-sidebar-accent-foreground">
                  {active.name}
                </span>
                <span className="truncate text-xs">{active.roleName}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>{t("switch")}</DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem key={org.id} onSelect={() => select(org.id)}>
                <Building2 />
                <span className="truncate">{org.name}</span>
                {org.id === activeId && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/onboarding">
                <Plus />
                {t("create")}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
