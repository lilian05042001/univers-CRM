import { ModulePlaceholder } from "@/components/shared/module-placeholder"
import { moduleMetadata } from "@/lib/i18n/metadata"

export const generateMetadata = moduleMetadata("automations")

export default function AutomationsPage() {
  return <ModulePlaceholder module="automations" />
}
