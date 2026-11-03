import Link from "next/link"
import { useTranslations } from "next-intl"

import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { settingsSections } from "@/config/settings-sections"
import { moduleMetadata } from "@/lib/i18n/metadata"

export const generateMetadata = moduleMetadata("settings")

export default function SettingsPage() {
  const t = useTranslations()

  return (
    <>
      <PageHeader title={t("nav.settings")} description={t("modules.settings")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {settingsSections.map((section) => {
          const content = (
            <Card
              className={
                section.href
                  ? "h-full transition-colors hover:border-primary/40"
                  : "h-full opacity-70"
              }
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <section.icon className="size-4 text-primary" />
                  {t(`settings.sections.${section.key}.title`)}
                </CardTitle>
                <CardDescription>
                  {t(`settings.sections.${section.key}.description`)}
                </CardDescription>
                {!section.href && (
                  <StatusBadge tone="neutral" className="mt-2">
                    {t("settings.stage", { stage: section.stage })}
                  </StatusBadge>
                )}
              </CardHeader>
            </Card>
          )
          return section.href ? (
            <Link
              key={section.key}
              href={section.href}
              className="rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {content}
            </Link>
          ) : (
            <div key={section.key}>{content}</div>
          )
        })}
      </div>
    </>
  )
}
