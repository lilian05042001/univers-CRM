import { describe, expect, it, vi } from "vitest"

import { sha256Hex } from "@/lib/utils/secret"

vi.mock("server-only", () => ({}))
// În afara unei cereri Next, connection() nu are context; în teste nu marchează nimic.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}))

const VALID_KEY = "ucrm_valid-key"
const ORG = "6f9619ff-8b86-4d11-b42d-00c04fc964ff"

// Baza de date simulată: authenticate_api_key întoarce cheia doar pentru hash-ul cheii valide.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (_fn: string, args: { p_hash: string }) => ({
      data:
        args.p_hash === sha256Hex(VALID_KEY)
          ? [{ key_id: "k1", organization_id: ORG, scopes: ["contacts:read"], created_by: "u1" }]
          : [],
      error: null,
    }),
  }),
}))

const { withApiKey } = await import("@/lib/api/auth")
const { ApiError, mapDbError, readListQuery } = await import("@/lib/api/http")
const { contactInput, leadInput } = await import("@/lib/api/schemas")

function request(key?: string, url = "http://localhost/api/v1/contacts") {
  return new Request(url, { headers: key ? { authorization: `Bearer ${key}` } : {} })
}

describe("API key authentication", () => {
  const handler = withApiKey("contacts:read", async (_req, ctx) =>
    Response.json({ org: ctx.organizationId })
  )

  it("rejects requests without a valid key", async () => {
    for (const key of [undefined, "ucrm_wrong"]) {
      const res = await handler(request(key))
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: { code: "unauthorized" } })
    }
  })

  it("passes the key's organization to the handler", async () => {
    const res = await handler(request(VALID_KEY))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ org: ORG })
  })

  it("enforces the scope of the endpoint", async () => {
    const write = withApiKey("contacts:write", async () => new Response(null, { status: 201 }))
    const res = await write(request(VALID_KEY))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: { code: "insufficient_scope" } })
  })

  it("returns handler errors as JSON with their status", async () => {
    const failing = withApiKey("contacts:read", async () => {
      throw new ApiError(422, "validation_failed", { title: "required" })
    })
    const res = await failing(request(VALID_KEY))
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      error: { code: "validation_failed", fields: { title: "required" } },
    })
  })
})

describe("API input", () => {
  it("validates list parameters", () => {
    expect(readListQuery(request(VALID_KEY, "http://x/api/v1/contacts"))).toMatchObject({
      limit: 50,
      offset: 0,
    })
    expect(() => readListQuery(request(VALID_KEY, "http://x/api/v1/contacts?limit=500"))).toThrow(
      ApiError
    )
    expect(() =>
      readListQuery(request(VALID_KEY, "http://x/api/v1/contacts?updated_since=ieri"))
    ).toThrow(ApiError)
  })

  it("rejects unknown fields and invalid values", () => {
    expect(contactInput.safeParse({ first_name: "Ion", organization_id: ORG }).success).toBe(false)
    expect(contactInput.safeParse({ first_name: "Ion", emails: ["nu-e-email"] }).success).toBe(
      false
    )
    expect(contactInput.safeParse({ first_name: "Ion", phones: ["+373 69 123 456"] }).success).toBe(
      true
    )
    expect(leadInput.safeParse({ title: "Lead", value: -1 }).success).toBe(false)
    expect(leadInput.safeParse({ title: "Lead", priority: "high", currency: "EUR" }).success).toBe(
      true
    )
  })

  it("maps database errors to API errors", () => {
    expect(mapDbError({ code: "23503" })).toMatchObject({ status: 422, code: "invalid_reference" })
    expect(mapDbError({ code: "23505" })).toMatchObject({ status: 409, code: "conflict" })
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(mapDbError(new Error("boom"))).toMatchObject({ status: 500, code: "internal_error" })
  })
})
