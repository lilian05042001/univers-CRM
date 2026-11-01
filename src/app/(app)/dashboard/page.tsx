import { ModulePlaceholder } from "@/components/shared/module-placeholder"
import { moduleMetadata } from "@/lib/i18n/metadata"

export const generateMetadata = moduleMetadata("dashboard")

export default function DashboardPage() {
  return <ModulePlaceholder module="dashboard" />
}
