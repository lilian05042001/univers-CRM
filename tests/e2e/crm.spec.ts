import { expect, test, type Page } from "@playwright/test"

import messages from "../../messages/ro.json"

import { hasDatabase, signUpWithCompany, skipReason } from "./support"

// Criteriul Etapei 4: contact nou → duplicat detectat → lead → filtrare și acțiuni în masă.
test.describe.configure({ mode: "serial" })
test.skip(!hasDatabase, skipReason)

const t = messages
let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await signUpWithCompany(page, "crm", `CRM E2E ${Date.now()}`)
})

test.afterAll(async () => {
  await page?.close()
})

test("creates a contact with a normalized phone number", async () => {
  await page.goto("/contacts")
  await page.getByRole("button", { name: t.contacts.create }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel(t.contacts.form.firstName, { exact: true }).fill("Ștefan")
  await dialog.getByLabel(t.contacts.form.lastName, { exact: true }).fill("Țurcan")
  await dialog.getByLabel(`${t.contacts.form.phones} 1`).fill("069 111 222")
  await dialog.getByLabel(`${t.contacts.form.emails} 1`).fill("stefan@client.md")
  await dialog.getByRole("button", { name: t.contacts.form.save }).click()

  await expect(page.getByText(t.contacts.form.created)).toBeVisible()
  const row = page.getByRole("row", { name: /Ștefan Țurcan/ })
  await expect(row).toContainText("+373 691 11 222")
  await expect(row).toContainText("stefan@client.md")
})

test("warns about a duplicate phone written differently", async () => {
  await page.getByRole("button", { name: t.contacts.create }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel(t.contacts.form.firstName, { exact: true }).fill("Altcineva")
  await dialog.getByLabel(`${t.contacts.form.phones} 1`).fill("+373 69 111 222")
  await expect(dialog.getByText(t.duplicates.title)).toBeVisible()
  await expect(dialog.getByText("Ștefan Țurcan")).toBeVisible()
  await dialog.getByRole("button", { name: t.contacts.form.cancel }).click()
})

test("finds the contact without diacritics", async () => {
  await page.getByPlaceholder(t.table.search).fill("stefan turcan")
  await expect(page).toHaveURL(/q=stefan/)
  await expect(page.getByRole("row", { name: /Ștefan Țurcan/ })).toBeVisible()
})

test("creates a lead linked to the contact", async () => {
  await page.goto("/leads")
  await page.getByRole("button", { name: t.leads.create }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel(t.leads.form.title).fill("Lead E2E")
  await dialog.getByLabel(t.leads.form.value).fill("15000")
  await dialog.getByRole("button", { name: t.leads.form.contact, exact: true }).click()
  await page.locator("[data-slot=popover-content]").getByPlaceholder(t.common.search).fill("turcan")
  await page.getByRole("option", { name: /Ștefan Țurcan/ }).click()
  await dialog.getByRole("button", { name: t.leads.form.save }).click()

  await expect(page.getByText(t.leads.form.created)).toBeVisible()
  const row = page.getByRole("row", { name: /Lead E2E/ })
  await expect(row).toContainText("Ștefan Țurcan")
  await expect(row).toContainText("15.000")
  await expect(row).toContainText("Lead nou")
})

test("filters leads and moves them in bulk", async () => {
  await page.goto("/leads?status=won")
  await expect(page.getByText(t.leads.emptyTitle)).toBeVisible()

  await page.goto("/leads?q=lead%20e2e")
  await page
    .getByRole("row", { name: /Lead E2E/ })
    .getByRole("checkbox")
    .check()
  await page.getByRole("button", { name: t.leads.bulk.move }).click()
  await page.getByRole("menuitem", { name: "Câștigat" }).click()
  await expect(page.getByText(t.leads.bulk.moved)).toBeVisible()

  await page.goto("/leads?status=won")
  await expect(page.getByRole("row", { name: /Lead E2E/ })).toContainText("Câștigat")
})

test("global search opens the contact", async () => {
  await page.goto("/dashboard")
  const input = page.getByPlaceholder(t.search.placeholder)
  await expect(async () => {
    await page.keyboard.press("Control+k")
    await expect(input).toBeVisible({ timeout: 1000 })
  }).toPass()
  await input.fill("turcan")
  await page.getByRole("option", { name: /Ștefan Țurcan/ }).click()
  await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]{36}$/)
  await expect(page.getByRole("heading", { level: 1, name: "Ștefan Țurcan" })).toBeVisible()
})
