import { ModulePlaceholder } from "@/components/shared/module-placeholder"
import { moduleMetadata } from "@/lib/i18n/metadata"

export const generateMetadata = moduleMetadata("settings")

export default function SettingsPage() {
  return <ModulePlaceholder module="settings" />
}
