import { ModulePlaceholder } from "@/components/shared/module-placeholder"
import { moduleMetadata } from "@/lib/i18n/metadata"

export const generateMetadata = moduleMetadata("reports")

export default function ReportsPage() {
  return <ModulePlaceholder module="reports" />
}
