import { ModulePlaceholder } from "@/components/shared/module-placeholder"
import { moduleMetadata } from "@/lib/i18n/metadata"

export const generateMetadata = moduleMetadata("pipeline")

export default function PipelinePage() {
  return <ModulePlaceholder module="pipeline" />
}
