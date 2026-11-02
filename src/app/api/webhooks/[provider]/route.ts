import { handleWebhook } from "@/lib/channels/inbound"

/** Intrări de la canale: /api/webhooks/internal, ulterior /api/webhooks/whatsapp etc. */
export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/[provider]">) {
  const { provider } = await ctx.params
  const outcome = await handleWebhook(provider, request)
  return Response.json(outcome.body, { status: outcome.status })
}
