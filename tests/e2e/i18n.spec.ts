import { expect, test } from "@playwright/test"

import en from "../../messages/en.json"
import ro from "../../messages/ro.json"
import ru from "../../messages/ru.json"

import { createUser, hasDatabase, login, signUpWithCompany, skipReason } from "./support"

// Etapa 12: interfața în română, engleză și rusă; URL-urile rămân fără prefix de limbă.

test("the browser language is used before any choice", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ru-RU" })
  const page = await context.newPage()
  await page.goto("/login")
  await expect(page.getByText(ru.auth.pages.login.description)).toBeVisible()
  await expect(page.locator("html")).toHaveAttribute("lang", "ru")
  await expect(page).toHaveURL(/\/login$/)
  await context.close()
})

test("the language chosen on the login page is remembered", async ({ page }) => {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  await page.getByRole("combobox", { name: ro.locale.label }).click()
  await page.getByRole("option", { name: "English" }).click()
  await expect(page.getByText(en.auth.pages.login.description)).toBeVisible()
  await page.goto("/forgot-password")
  await expect(page.getByRole("button", { name: en.auth.sendResetLink })).toBeVisible()
})

test("a link with a language prefix switches the language and keeps clean URLs", async ({
  page,
}) => {
  await page.goto("/en/login")
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText(en.auth.pages.login.description)).toBeVisible()
})

test("the profile language follows the user to a new device", async ({ browser, page }) => {
  test.skip(!hasDatabase, skipReason)
  const user = await signUpWithCompany(page, "i18n", `Limbi E2E ${Date.now()}`)
  await page.goto("/profile")
  await page.getByRole("combobox", { name: ro.locale.label }).click()
  await page.getByRole("option", { name: "Русский" }).click()
  await expect(page.getByRole("link", { name: ru.nav.contacts })).toBeVisible()
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(ru.profile.title)

  // Alt dispozitiv (fără cookie, browser în română): după autentificare, limba din profil.
  const context = await browser.newContext({ locale: "ro-RO" })
  const other = await context.newPage()
  await login(other, user)
  await expect(other.getByRole("link", { name: ru.nav.contacts })).toBeVisible()
  await context.close()
})

test("a new user's interface starts in the browser language", async ({ browser }) => {
  test.skip(!hasDatabase, skipReason)
  const user = await createUser("i18n-en")
  const context = await browser.newContext({ locale: "en-US" })
  const page = await context.newPage()
  await page.goto("/login")
  await page.getByLabel(en.auth.email).fill(user.email)
  await page.getByLabel(en.auth.password).fill(user.password)
  await page.getByRole("button", { name: en.auth.signIn }).click()
  await expect(page.getByText(en.onboarding.description)).toBeVisible()
  await context.close()
})
