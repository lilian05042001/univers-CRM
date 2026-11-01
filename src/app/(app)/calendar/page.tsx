import { ModulePlaceholder } from "@/components/shared/module-placeholder"
import { moduleMetadata } from "@/lib/i18n/metadata"

export const generateMetadata = moduleMetadata("calendar")

export default function CalendarPage() {
  return <ModulePlaceholder module="calendar" />
}
