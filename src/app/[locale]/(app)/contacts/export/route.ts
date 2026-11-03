import { exportResponse } from "@/modules/import-export/export"

/** Exportul CSV al listei, cu filtrele din URL (necesită data.export). */
export async function GET(request: Request, ctx: RouteContext<"/[locale]/contacts/export">) {
  const { locale } = await ctx.params
  return exportResponse("contacts", request, locale)
}
