import { ModulePlaceholder } from "@/components/shared/module-placeholder"
import { moduleMetadata } from "@/lib/i18n/metadata"

export const generateMetadata = moduleMetadata("leads")

export default function LeadsPage() {
  return <ModulePlaceholder module="leads" />
}
