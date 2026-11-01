import { ModulePlaceholder } from "@/components/shared/module-placeholder"
import { moduleMetadata } from "@/lib/i18n/metadata"

export const generateMetadata = moduleMetadata("contacts")

export default function ContactsPage() {
  return <ModulePlaceholder module="contacts" />
}
