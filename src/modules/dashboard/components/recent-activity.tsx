"use client"

import { Timeline } from "@/modules/activity/components/timeline"
import { nameById } from "@/modules/crm-config/options"
import type { NamedOption } from "@/modules/crm-config/types"
import type { RecentActivity as Item } from "@/modules/reports/queries"

/** Fluxul de activitate recentă din dashboard (aceeași prezentare ca în fișe). */
export function RecentActivity({ items, members }: { items: Item[]; members: NamedOption[] }) {
  return <Timeline items={items} memberName={nameById(members)} />
}
