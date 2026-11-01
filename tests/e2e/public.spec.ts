import { expect, test } from "@playwright/test"

import messages from "../../messages/ro.json"

test("protected pages redirect to login and keep the destination", async ({ page }) => {
  await page.goto("/team")
  await expect(page).toHaveURL(/\/login\?next=%2Fteam$/)
  await expect(page.getByText(messages.auth.pages.login.description)).toBeVisible()
})

test("root redirects anonymous visitors to login", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/login/)
})

test("register form validates on the client in Romanian", async ({ page }) => {
  await page.goto("/register")
  await page.getByLabel(messages.auth.fullName).fill("I")
  await page.getByLabel(messages.auth.email).fill("nu-e-email")
  await page.getByLabel(messages.auth.password).fill("scurt")
  await page.getByRole("button", { name: messages.auth.createAccount }).click()

  await expect(page.getByText(messages.validation.nameMin)).toBeVisible()
  await expect(page.getByText(messages.validation.email)).toBeVisible()
  await expect(page.getByText(messages.validation.passwordMin)).toBeVisible()
})

test("login page links to registration and password reset", async ({ page }) => {
  await page.goto("/login")
  await page.getByRole("link", { name: messages.auth.forgotPassword }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)
  await page.getByRole("link", { name: messages.auth.backToLogin }).click()
  await page.getByRole("link", { name: messages.auth.signUp }).click()
  await expect(page).toHaveURL(/\/register$/)
})

test("invalid invitation link shows a clear message", async ({ page }) => {
  test.skip(!process.env.SUPABASE_SECRET_KEY, "necesită Supabase local (npm run db:start)")
  await page.goto("/invite/token-inexistent-0000000000")
  await expect(page.getByText(messages.invite.invalidTitle)).toBeVisible()
})
