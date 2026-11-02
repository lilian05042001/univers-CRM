import { z } from "zod"

import { withApiKey } from "@/lib/api/auth"
import { apiJson, listResponse, readBody, readListQuery, validationError } from "@/lib/api/http"
import { createLead, listLeads } from "@/lib/api/leads"
import { leadInput } from "@/lib/api/schemas"

const filtersSchema = z.object({
  status: z.enum(["open", "won", "lost"]).optional(),
  pipeline_id: z.uuid().optional(),
})

export const GET = withApiKey("leads:read", async (request, ctx) => {
  const query = readListQuery(request)
  const searchParams = new URL(request.url).searchParams
  const filters = filtersSchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    pipeline_id: searchParams.get("pipeline_id") ?? undefined,
  })
  if (!filters.success) throw validationError(filters.error)
  const { data, total } = await listLeads(ctx, query, filters.data)
  return listResponse(data, total, query)
})

export const POST = withApiKey("leads:write", async (request, ctx) => {
  const input = await readBody(request, leadInput)
  return apiJson({ data: await createLead(ctx, input) }, 201)
})
