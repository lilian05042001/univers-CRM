import { ModulePlaceholder } from "@/components/shared/module-placeholder"
import { moduleMetadata } from "@/lib/i18n/metadata"

export const generateMetadata = moduleMetadata("team")

export default function TeamPage() {
  return <ModulePlaceholder module="team" />
}
