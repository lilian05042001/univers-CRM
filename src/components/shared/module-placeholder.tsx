import { useTranslations } from "next-intl"

import { getNavItem, type NavKey } from "@/config/navigation"

import { EmptyState } from "./empty-state"
import { PageHeader } from "./page-header"
import { StatusBadge } from "./status-badge"

/** Pagină temporară pentru modulele care nu au fost încă implementate. */
export function ModulePlaceholder({ module }: { module: NavKey }) {
  const t = useTranslations()
  const item = getNavItem(module)

  return (
    <>
      <PageHeader
        title={t(`nav.${module}`)}
        description={t(`modules.${module}`)}
        actions={
          <StatusBadge tone="warning" dot>
            {t("common.comingSoon")}
          </StatusBadge>
        }
      />
      <EmptyState
        icon={item.icon}
        title={t("common.comingSoon")}
        description={t("common.availableInStage", { stage: item.stage })}
      />
    </>
  )
}
