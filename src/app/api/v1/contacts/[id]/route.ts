import { withApiKey } from "@/lib/api/auth"
import { deleteContact, getContact, updateContact } from "@/lib/api/contacts"
import { apiJson, parseId, readBody } from "@/lib/api/http"
import { contactInput } from "@/lib/api/schemas"

type Params = { id: string }

export const GET = withApiKey<Params>("contacts:read", async (_request, ctx, { id }) =>
  apiJson({ data: await getContact(ctx, parseId(id)) })
)

export const PATCH = withApiKey<Params>("contacts:write", async (request, ctx, { id }) => {
  const input = await readBody(request, contactInput)
  return apiJson({ data: await updateContact(ctx, parseId(id), input) })
})

export const DELETE = withApiKey<Params>("contacts:write", async (_request, ctx, { id }) => {
  await deleteContact(ctx, parseId(id))
  return new Response(null, { status: 204 })
})
