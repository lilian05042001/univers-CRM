import { expect, test } from "@playwright/test"

import messages from "../../messages/ro.json"
import { navItems } from "../../src/config/navigation"

test("root redirects to the dashboard", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.nav.dashboard)
})

test("every module page renders with its title", async ({ page }) => {
  for (const item of navItems) {
    await page.goto(item.href)
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.nav[item.key])
    await expect(page).toHaveTitle(new RegExp(messages.nav[item.key]))
  }
})

test("sidebar navigates between modules", async ({ page, isMobile }) => {
  await page.goto("/dashboard")
  if (isMobile) await page.getByRole("button", { name: messages.topbar.toggleSidebar }).click()
  await page.getByRole("link", { name: messages.nav.contacts }).click()
  await expect(page).toHaveURL(/\/contacts$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.nav.contacts)
})

test("Ctrl+K opens global search and navigates", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard shortcut is desktop-only")
  await page.goto("/dashboard")
  const input = page.getByPlaceholder(messages.search.placeholder)
  // Shortcut-ul funcționează doar după hidratare; reîncearcă până se deschide paleta.
  await expect(async () => {
    await page.keyboard.press("Control+k")
    await expect(input).toBeVisible({ timeout: 1000 })
  }).toPass()
  await input.fill(messages.nav.pipeline)
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/pipeline$/)
})
