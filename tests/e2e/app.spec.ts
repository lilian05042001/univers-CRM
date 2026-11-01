import { expect, test, type Page } from "@playwright/test"

import messages from "../../messages/ro.json"
import { navItems } from "../../src/config/navigation"

import { createUser, hasDatabase, login, skipReason, type TestUser } from "./support"

// Fluxurile autentificate rulează pe Supabase local: utilizatorul de test e creat prin Admin API.
const runId = Date.now()
const company = `Compania E2E ${runId}`

test.describe.configure({ mode: "serial" })
test.skip(!hasDatabase, skipReason)

let page: Page

let user: TestUser

test.beforeAll(async ({ browser }) => {
  user = await createUser("app")
  page = await browser.newPage()
})

test.afterAll(async () => {
  await page?.close()
})

test("new user signs in and is sent to onboarding", async () => {
  await login(page, user)
  await expect(page).toHaveURL(/\/onboarding$/)
})

test("creating a company makes the user its administrator", async () => {
  await page.getByLabel(messages.onboarding.companyName).fill(company)
  await page.getByRole("button", { name: messages.onboarding.create }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByText(company)).toBeVisible()
  await expect(page.getByText("Administrator", { exact: true })).toBeVisible()
})

test("every module page renders with its title", async () => {
  for (const item of navItems) {
    await page.goto(item.href)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.nav[item.key])
  }
})

test("Ctrl+K opens global search and navigates", async () => {
  await page.goto("/dashboard")
  const input = page.getByPlaceholder(messages.search.placeholder)
  await expect(async () => {
    await page.keyboard.press("Control+k")
    await expect(input).toBeVisible({ timeout: 1000 })
  }).toPass()
  await input.fill(messages.nav.pipeline)
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/pipeline$/)
})

test("admin invites a colleague and gets a one-time link", async () => {
  await page.goto("/team")
  await page.getByRole("button", { name: messages.team.invite.open }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel(messages.team.invite.email).fill(`coleg-${runId}@test.md`)
  await dialog.getByRole("button", { name: messages.team.invite.submit }).click()
  await expect(dialog.getByLabel(messages.team.invite.link)).toHaveValue(/\/invite\/[\w-]{40,}$/)
  await dialog.getByRole("button", { name: messages.team.invite.done }).click()

  await page.getByRole("tab", { name: /Invitații/ }).click()
  await expect(page.getByText(`coleg-${runId}@test.md`)).toBeVisible()
})

test("admin updates company settings", async () => {
  await page.goto("/settings/company")
  await page.getByLabel(messages.settings.company.fiscalCode).fill("1003600012345")
  await page.getByRole("button", { name: messages.settings.company.save }).click()
  await expect(page.getByText(messages.settings.company.saved)).toBeVisible()
})

test("sign out returns to login", async () => {
  await page.getByRole("button", { name: messages.user.menu }).click()
  await page.getByRole("menuitem", { name: messages.user.signOut }).click()
  await expect(page).toHaveURL(/\/login$/)
})
