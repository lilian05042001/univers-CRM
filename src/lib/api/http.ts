import "server-only"

import { z } from "zod"

/** Eroare a API-ului public: cod stabil (documentat în docs/API.md) + detalii opționale. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details?: Record<string, string>
  ) {
    super(code)
  }
}

export function apiJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } })
}

export function errorResponse(error: ApiError): Response {
  return apiJson(
    { error: { code: error.code, ...(error.details && { fields: error.details }) } },
    error.status
  )
}

const MAX_BODY_BYTES = 64 * 1024

/** Corpul JSON validat cu schema; erorile devin 400/422 cu câmpurile greșite. */
export async function readBody<S extends z.ZodType>(
  request: Request,
  schema: S
): Promise<z.output<S>> {
  const raw = await request.text()
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new ApiError(413, "payload_too_large")
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    throw new ApiError(400, "invalid_json")
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) throw validationError(parsed.error)
  return parsed.data
}

export function validationError(error: z.ZodError): ApiError {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) fields[issue.path.join(".") || "_"] ??= issue.message
  return new ApiError(422, "validation_failed", fields)
}

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  q: z.string().trim().max(100).optional(),
  updated_since: z.iso.datetime({ offset: true }).optional(),
})

export type ListQuery = z.output<typeof listSchema>

/** Paginare și filtre comune listelor: ?limit=&offset=&q=&updated_since= */
export function readListQuery(request: Request): ListQuery {
  const params = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = listSchema.safeParse(params)
  if (!parsed.success) throw validationError(parsed.error)
  return parsed.data
}

export function listResponse(data: unknown[], total: number, query: ListQuery): Response {
  return apiJson({ data, pagination: { total, limit: query.limit, offset: query.offset } })
}

export const idSchema = z.uuid()

export function parseId(value: string): string {
  if (!idSchema.safeParse(value).success) throw new ApiError(404, "not_found")
  return value
}

/** Erorile Postgres → răspunsuri ale API-ului (referințe din altă organizație = FK compus încălcat). */
export function mapDbError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  switch ((error as { code?: string })?.code) {
    case "23503":
      return new ApiError(422, "invalid_reference")
    case "23505":
      return new ApiError(409, "conflict")
    case "23514":
    case "22001":
    case "22P02":
      return new ApiError(422, "invalid_value")
  }
  console.error("[api] unexpected error", error)
  return new ApiError(500, "internal_error")
}
