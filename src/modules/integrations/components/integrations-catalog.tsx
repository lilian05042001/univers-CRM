import { ArrowRight, FileUp, KeyRound } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"

import { StatusBadge, type StatusTone } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { ChannelProvider } from "@/lib/channels/types"
import { ChannelIcon } from "@/modules/inbox/components/channel-icon"

type Item = {
  key: string
  icon: ReactNode
  status: "active" | "available" | "planned"
  href?: `/${string}`
}

const TONE: Record<Item["status"], StatusTone> = {
  active: "success",
  available: "info",
  planned: "neutral",
}

const PLANNED: ChannelProvider[] = ["whatsapp", "instagram", "messenger", "email", "telephony"]

/** Integrările disponibile acum și cele planificate (conectare doar prin API-uri oficiale). */
export function IntegrationsCatalog({ activeApiKeys }: { activeApiKeys: number }) {
  const t = useTranslations("integrations.catalog")
  const icon = "size-4 text-primary"

  const items: Item[] = [
    {
      key: "internal",
      icon: <ChannelIcon provider="internal" className={icon} />,
      status: "active",
      href: "/settings/channels",
    },
    {
      key: "api",
      icon: <KeyRound className={icon} />,
      status: activeApiKeys > 0 ? "active" : "available",
      href: "/settings/api",
    },
    {
      key: "csv",
      icon: <FileUp className={icon} />,
      status: "available",
      href: "/settings/import-export",
    },
    ...PLANNED.map((provider) => ({
      key: provider,
      icon: <ChannelIcon provider={provider} className="size-4 text-muted-foreground" />,
      status: "planned" as const,
    })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-sm text-muted-foreground">{t("intro")}</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card key={item.key} className={item.status === "planned" ? "opacity-80" : undefined}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {item.icon}
                {t(`items.${item.key}.title`)}
              </CardTitle>
              <CardDescription>{t(`items.${item.key}.description`)}</CardDescription>
              <StatusBadge tone={TONE[item.status]} className="mt-2">
                {t(`status.${item.status}`)}
              </StatusBadge>
            </CardHeader>
            {item.href && (
              <CardFooter className="mt-auto">
                <Button asChild variant="outline" size="sm">
                  <Link href={item.href}>
                    {t("configure")}
                    <ArrowRight />
                  </Link>
                </Button>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
