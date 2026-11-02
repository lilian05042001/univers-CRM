import { withApiKey } from "@/lib/api/auth"
import { createCompany, listCompanies } from "@/lib/api/companies"
import { apiJson, listResponse, readBody, readListQuery } from "@/lib/api/http"
import { companyInput } from "@/lib/api/schemas"

export const GET = withApiKey("contacts:read", async (request, ctx) => {
  const query = readListQuery(request)
  const { data, total } = await listCompanies(ctx, query)
  return listResponse(data, total, query)
})

export const POST = withApiKey("contacts:write", async (request, ctx) => {
  const input = await readBody(request, companyInput)
  return apiJson({ data: await createCompany(ctx, input) }, 201)
})
