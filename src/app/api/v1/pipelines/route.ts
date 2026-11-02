import { withApiKey } from "@/lib/api/auth"
import { apiJson } from "@/lib/api/http"
import { listPipelines } from "@/lib/api/leads"

export const GET = withApiKey("leads:read", async (_request, ctx) =>
  apiJson({ data: await listPipelines(ctx) })
)
