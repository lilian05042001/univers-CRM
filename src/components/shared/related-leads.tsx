"use client"

import { Target } from "lucide-react"
import Link from "next/link"
import { useTranslations } from "next-intl"

import { StageBadge } from "@/components/shared/stage-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useMoney } from "@/hooks/use-money"

export type RelatedLead = {
  id: string
  title: string
  value: number
  currency: string
  stage: { name: string; color: string }
}

/** Lista lead-urilor asociate unui contact / unei companii. */
export function RelatedLeads({ leads }: { leads: RelatedLead[] }) {
  const t = useTranslations("detail")
  const money = useMoney()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="size-4 text-muted-foreground" />
          {t("leads", { count: leads.length })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noLeads")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {leads.map((lead) => (
              <li key={lead.id} className="flex flex-col gap-0.5 text-sm">
                <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                  {lead.title}
                </Link>
                <span className="flex items-center gap-3 text-muted-foreground">
                  <StageBadge name={lead.stage.name} color={lead.stage.color} />
                  <span className="tabular-nums">{money(lead.value, lead.currency)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
