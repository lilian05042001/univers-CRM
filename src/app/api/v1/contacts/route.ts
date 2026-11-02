import { withApiKey } from "@/lib/api/auth"
import { createContact, listContacts } from "@/lib/api/contacts"
import { apiJson, listResponse, readBody, readListQuery } from "@/lib/api/http"
import { contactInput } from "@/lib/api/schemas"

export const GET = withApiKey("contacts:read", async (request, ctx) => {
  const query = readListQuery(request)
  const { data, total } = await listContacts(ctx, query)
  return listResponse(data, total, query)
})

export const POST = withApiKey("contacts:write", async (request, ctx) => {
  const input = await readBody(request, contactInput)
  return apiJson({ data: await createContact(ctx, input) }, 201)
})
