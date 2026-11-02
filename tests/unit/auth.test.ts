import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { matchesPath, PUBLIC_PATHS, safeNextPath } from "@/lib/auth/routes"
import { PERMISSIONS, roleHasPermission } from "@/modules/auth/permissions"
import { registerSchema } from "@/modules/auth/schemas"

function sqlPermissionCatalog(): string[] {
  const dir = join(process.cwd(), "supabase", "migrations")
  const sql = readdirSync(dir)
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n")
  // Ultima definiție a private.permission_catalog() câștigă.
  const bodies = [
    ...sql.matchAll(
      /function private\.permission_catalog\(\)[\s\S]*?select array\[([\s\S]*?)\]::text\[\]/g
    ),
  ]
  const body = bodies.at(-1)?.[1] ?? ""
  return [...body.matchAll(/'([a-z_.]+)'/g)].map((m) => m[1]!)
}

describe("permissions", () => {
  it("TS catalog mirrors private.permission_catalog() from SQL", () => {
    expect([...PERMISSIONS].sort()).toEqual(sqlPermissionCatalog().sort())
  })

  it("admin has every permission; other roles only the listed ones", () => {
    expect(roleHasPermission({ key: "admin", permissions: [] }, "settings.manage")).toBe(true)
    expect(roleHasPermission({ key: "agent", permissions: ["leads.create"] }, "leads.create")).toBe(
      true
    )
    expect(roleHasPermission({ key: "agent", permissions: ["leads.create"] }, "leads.delete")).toBe(
      false
    )
  })
})

describe("routes", () => {
  it("allows only internal relative redirects", () => {
    expect(safeNextPath("/team?tab=1")).toBe("/team?tab=1")
    expect(safeNextPath("https://evil.example")).toBe("/dashboard")
    expect(safeNextPath("//evil.example")).toBe("/dashboard")
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard")
    expect(safeNextPath(null, "/onboarding")).toBe("/onboarding")
  })

  it("matches public paths by segment", () => {
    expect(matchesPath("/invite/abc", PUBLIC_PATHS)).toBe(true)
    expect(matchesPath("/auth/callback", PUBLIC_PATHS)).toBe(true)
    expect(matchesPath("/loginx", PUBLIC_PATHS)).toBe(false)
    expect(matchesPath("/dashboard", PUBLIC_PATHS)).toBe(false)
  })
})

describe("registerSchema", () => {
  const base = { fullName: "Ion Popescu", email: " Ion@Example.MD ", password: "parola123" }

  it("normalizes e-mail", () => {
    expect(registerSchema.parse(base).email).toBe("ion@example.md")
  })

  it("enforces the password policy (8+ chars, letters and digits)", () => {
    expect(registerSchema.safeParse({ ...base, password: "scurt1" }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, password: "doarlitere" }).success).toBe(false)
    expect(registerSchema.safeParse({ ...base, password: "12345678" }).success).toBe(false)
  })
})
