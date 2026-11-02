import { Download } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

import { EXPORT_ENTITIES } from "../export"

/** Exportul complet al fiecărei liste (cu filtre: butonul „Exportă” din lista respectivă). */
export function ExportPanel() {
  const t = useTranslations("importExport")
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("exportHint")}</p>
      <div className="flex flex-wrap gap-2">
        {EXPORT_ENTITIES.map((entity) => (
          <Button key={entity} asChild variant="outline">
            <a href={`/${entity}/export`} download>
              <Download />
              {t(`exportEntities.${entity}`)}
            </a>
          </Button>
        ))}
      </div>
    </div>
  )
}
