import { withApiKey } from "@/lib/api/auth"
import { deleteCompany, getCompany, updateCompany } from "@/lib/api/companies"
import { apiJson, parseId, readBody } from "@/lib/api/http"
import { companyInput } from "@/lib/api/schemas"

type Params = { id: string }

export const GET = withApiKey<Params>("contacts:read", async (_request, ctx, { id }) =>
  apiJson({ data: await getCompany(ctx, parseId(id)) })
)

export const PATCH = withApiKey<Params>("contacts:write", async (request, ctx, { id }) => {
  const input = await readBody(request, companyInput)
  return apiJson({ data: await updateCompany(ctx, parseId(id), input) })
})

export const DELETE = withApiKey<Params>("contacts:write", async (_request, ctx, { id }) => {
  await deleteCompany(ctx, parseId(id))
  return new Response(null, { status: 204 })
})
