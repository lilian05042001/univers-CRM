"use client"

import { Check, Copy } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"

import { Button } from "@/components/ui/button"

/** Valoare de copiat (adresă webhook, cheie afișată o singură dată, exemplu de cerere). */
export function CopyField({ label, value }: { label: string; value: string }) {
  const t = useTranslations("common")
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1.5">
        <code className="min-w-0 flex-1 text-xs break-all">{value}</code>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("copy")}
          onClick={async () => {
            await navigator.clipboard.writeText(value)
            setCopied(true)
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  )
}
