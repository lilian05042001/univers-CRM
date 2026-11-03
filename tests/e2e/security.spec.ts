import { expect, test } from "@playwright/test"

import messages from "../../messages/ro.json"

import { hasDatabase, skipReason } from "./support"

// Etapa 12: headere de securitate și limitarea încercărilor de autentificare.

test("pages are served with the security headers", async ({ request }) => {
  const res = await request.get("/login")
  const headers = res.headers()
  const csp = headers["content-security-policy"] ?? ""
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("frame-ancestors 'none'")
  expect(csp).toContain("object-src 'none'")
  expect(csp).toMatch(/connect-src 'self' https?:\/\/[^ ]+ wss?:\/\//)
  expect(headers["x-content-type-options"]).toBe("nosniff")
  expect(headers["x-frame-options"]).toBe("DENY")
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin")
  expect(headers["x-powered-by"]).toBeUndefined()
})

test("repeated wrong passwords for one e-mail are blocked", async ({ page }) => {
  test.skip(!hasDatabase, skipReason)
  test.setTimeout(60_000)
  const email = `brute-${Date.now()}@test.md`
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  await page.getByLabel(messages.auth.email).fill(email)

  // Limita pe e-mail: 10 încercări în 15 minute; a 11-a e refuzată fără a mai contacta Supabase Auth.
  for (let attempt = 1; attempt <= 11; attempt++) {
    await page.getByLabel(messages.auth.password).fill(`Gresit${attempt}x`)
    const response = page.waitForResponse((r) => r.request().method() === "POST")
    await page.getByRole("button", { name: messages.auth.signIn }).click()
    await response
    const expected =
      attempt <= 10 ? messages.errors.auth.invalidCredentials : messages.errors.auth.rateLimited
    await expect(page.getByText(expected)).toBeVisible()
  }
})
