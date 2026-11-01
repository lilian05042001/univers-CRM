import { ModulePlaceholder } from "@/components/shared/module-placeholder"
import { moduleMetadata } from "@/lib/i18n/metadata"

export const generateMetadata = moduleMetadata("inbox")

export default function InboxPage() {
  return <ModulePlaceholder module="inbox" />
}
