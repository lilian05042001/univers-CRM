import { Lock } from "lucide-react"
import { useTranslations } from "next-intl"

import { EmptyState } from "@/components/shared/empty-state"

export function NoAccess() {
  const t = useTranslations("automations")
  return <EmptyState icon={Lock} title={t("noAccessTitle")} description={t("noAccessHint")} />
}
