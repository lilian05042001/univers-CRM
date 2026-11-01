import { ModulePlaceholder } from "@/components/shared/module-placeholder"
import { moduleMetadata } from "@/lib/i18n/metadata"

export const generateMetadata = moduleMetadata("companies")

export default function CompaniesPage() {
  return <ModulePlaceholder module="companies" />
}
