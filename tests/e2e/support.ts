import { expect, type Page } from "@playwright/test"

import messages from "../../messages/ro.json"

export const hasDatabase = Boolean(process.env.SUPABASE_SECRET_KEY)
export const skipReason =
  "necesită Supabase local (npm run db:start) și SUPABASE_SECRET_KEY în .env.local"

export type TestUser = { email: string; password: string; fullName: string }

/** Utilizator nou, cu e-mail confirmat, creat prin Admin API (doar local). */
export async function createUser(prefix: string): Promise<TestUser> {
  const user = {
    email: `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.md`,
    password: "Parola123",
    fullName: "Test E2E",
  }
  const secret = process.env.SUPABASE_SECRET_KEY!
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
    }),
  })
  expect(res.ok, await res.text()).toBe(true)
  return user
}

export async function login(page: Page, user: TestUser) {
  await page.goto("/login")
  await page.getByLabel(messages.auth.email).fill(user.email)
  await page.getByLabel(messages.auth.password).fill(user.password)
  await page.getByRole("button", { name: messages.auth.signIn }).click()
}

/** Utilizator nou + companie proprie, autentificat și ajuns în Dashboard. */
export async function signUpWithCompany(page: Page, prefix: string, company: string) {
  const user = await createUser(prefix)
  await login(page, user)
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByLabel(messages.onboarding.companyName).fill(company)
  await page.getByRole("button", { name: messages.onboarding.create }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  return user
}
