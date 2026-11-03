import { exportResponse } from "@/modules/import-export/export"

/** Exportul CSV al listei, cu filtrele din URL (necesită data.export). */
export async function GET(request: Request, ctx: RouteContext<"/[locale]/leads/export">) {
  const { locale } = await ctx.params
  return exportResponse("leads", request, locale)
}
