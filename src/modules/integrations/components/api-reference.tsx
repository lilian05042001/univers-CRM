import { useTranslations } from "next-intl"

import { CopyField } from "@/components/shared/copy-field"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ApiScope } from "@/lib/api/scopes"

const ENDPOINTS: { method: string; path: string; scope: ApiScope }[] = [
  { method: "GET", path: "/contacts", scope: "contacts:read" },
  { method: "POST", path: "/contacts", scope: "contacts:write" },
  { method: "GET", path: "/contacts/{id}", scope: "contacts:read" },
  { method: "PATCH · DELETE", path: "/contacts/{id}", scope: "contacts:write" },
  { method: "GET", path: "/companies", scope: "contacts:read" },
  { method: "POST", path: "/companies", scope: "contacts:write" },
  { method: "GET", path: "/companies/{id}", scope: "contacts:read" },
  { method: "PATCH · DELETE", path: "/companies/{id}", scope: "contacts:write" },
  { method: "GET", path: "/leads", scope: "leads:read" },
  { method: "POST", path: "/leads", scope: "leads:write" },
  { method: "GET", path: "/leads/{id}", scope: "leads:read" },
  { method: "PATCH · DELETE", path: "/leads/{id}", scope: "leads:write" },
  { method: "GET", path: "/pipelines", scope: "leads:read" },
]

/** Referința rapidă a API-ului v1 (documentația completă: docs/API.md). */
export function ApiReference({ baseUrl }: { baseUrl: string }) {
  const t = useTranslations("integrations.api.reference")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <CopyField label={t("baseUrl")} value={baseUrl} />
        <CopyField
          label={t("example")}
          value={`curl -H "Authorization: Bearer ucrm_…" "${baseUrl}/contacts?limit=20&q=popescu"`}
        />
        <p className="text-xs text-muted-foreground">{t("conventions")}</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("method")}</TableHead>
              <TableHead>{t("path")}</TableHead>
              <TableHead>{t("scope")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ENDPOINTS.map((e) => (
              <TableRow key={`${e.method} ${e.path}`}>
                <TableCell className="font-mono text-xs">{e.method}</TableCell>
                <TableCell className="font-mono text-xs">{e.path}</TableCell>
                <TableCell className="font-mono text-xs">{e.scope}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
