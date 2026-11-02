import { withApiKey } from "@/lib/api/auth"
import { apiJson, parseId, readBody } from "@/lib/api/http"
import { deleteLead, getLead, updateLead } from "@/lib/api/leads"
import { leadInput } from "@/lib/api/schemas"

type Params = { id: string }

export const GET = withApiKey<Params>("leads:read", async (_request, ctx, { id }) =>
  apiJson({ data: await getLead(ctx, parseId(id)) })
)

export const PATCH = withApiKey<Params>("leads:write", async (request, ctx, { id }) => {
  const input = await readBody(request, leadInput)
  return apiJson({ data: await updateLead(ctx, parseId(id), input) })
})

export const DELETE = withApiKey<Params>("leads:write", async (_request, ctx, { id }) => {
  await deleteLead(ctx, parseId(id))
  return new Response(null, { status: 204 })
})
