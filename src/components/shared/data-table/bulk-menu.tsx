"use client"

import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type BulkOption = { value: string | null; label: string }

/** Acțiune în masă cu alegerea unei valori (responsabil, etapă, etichetă). */
export function BulkMenu({
  label,
  icon: Icon,
  options,
  onPick,
  disabled,
}: {
  label: string
  icon: LucideIcon
  options: BulkOption[]
  onPick: (value: string | null) => void
  disabled?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Icon />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        {options.map((o) => (
          <DropdownMenuItem key={o.value ?? "__none__"} onSelect={() => onPick(o.value)}>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
