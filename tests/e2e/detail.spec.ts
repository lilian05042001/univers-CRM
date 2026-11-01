import { expect, test, type Page } from "@playwright/test"

import messages from "../../messages/ro.json"

import { hasDatabase, signUpWithCompany, skipReason } from "./support"

// Criteriul Etapei 6: fișa lead-ului — note, sarcini, fișiere, etapă, cronologie, client.
test.describe.configure({ mode: "serial" })
test.skip(!hasDatabase, skipReason)

const t = messages
let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
  await signUpWithCompany(page, "detail", `Detail E2E ${Date.now()}`)

  await page.goto("/leads")
  await page.getByRole("button", { name: t.leads.create }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel(t.leads.form.title).fill("Fișă E2E")
  await dialog.getByLabel(t.leads.form.value).fill("8000")
  await dialog.getByLabel(t.leads.form.newContactName).fill("Mihai Lungu")
  await dialog.getByLabel(t.leads.form.newContactPhone).fill("079 222 333")
  await dialog.getByRole("button", { name: t.leads.form.save }).click()
  await expect(page.getByText(t.leads.form.created)).toBeVisible()
})

test.afterAll(async () => {
  await page?.close()
})

test("clicking a row opens the lead page with client and commercial data", async () => {
  await page.getByRole("row", { name: /Fișă E2E/ }).click()
  await expect(page).toHaveURL(/\/leads\/[0-9a-f-]{36}$/)
  await expect(page.getByRole("heading", { level: 1, name: "Fișă E2E" })).toBeVisible()
  await expect(page.getByRole("link", { name: /Mihai Lungu/ })).toBeVisible()
  await expect(page.getByRole("link", { name: /\+373 792 22 333|\+373 79 222 333/ })).toBeVisible()
  await expect(page.getByText(t.activity.types.lead.created)).toBeVisible()
})

test("adds a note that appears in notes and the timeline", async () => {
  await page.getByRole("tab", { name: /Note/ }).click()
  await page.getByLabel(t.notes.placeholder).fill("Clientul vrea ofertă până vineri.")
  await page.getByRole("button", { name: t.notes.add }).click()
  await expect(page.getByText(t.notes.added)).toBeVisible()
  await expect(page.getByRole("tab", { name: "Note (1)" })).toBeVisible()

  await page.getByRole("tab", { name: t.workspace.timeline }).click()
  await expect(page.getByText(/Notă: Clientul vrea ofertă/)).toBeVisible()
})

test("creates and completes a task", async () => {
  await page.getByRole("tab", { name: /Sarcini/ }).click()
  await page.getByRole("button", { name: t.tasks.create }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel(t.tasks.form.title).fill("Trimite oferta")
  await dialog.getByRole("button", { name: t.common.save }).click()
  await expect(page.getByText(t.tasks.created)).toBeVisible()
  await expect(page.getByRole("tab", { name: "Sarcini (1)" })).toBeVisible()

  await page.getByRole("checkbox", { name: /Finalizează „Trimite oferta”/ }).click()
  await expect(page.getByText(t.tasks.completed)).toBeVisible()
  await expect(page.getByRole("tab", { name: "Sarcini (0)" })).toBeVisible()
})

test("uploads a file", async () => {
  await page.getByRole("tab", { name: /Fișiere/ }).click()
  await page.locator('input[type="file"]').setInputFiles({
    name: "oferta.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 test"),
  })
  await expect(page.getByText(/„oferta.pdf” a fost încărcat/)).toBeVisible()
  await expect(page.getByRole("tab", { name: "Fișiere (1)" })).toBeVisible()
  await expect(page.getByText("oferta.pdf", { exact: true })).toBeVisible()
})

test("rejects executable files", async () => {
  await page.locator('input[type="file"]').setInputFiles({
    name: "virus.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("MZ"),
  })
  await expect(page.getByText(/virus\.exe: Fișierul nu este permis/)).toBeVisible()
})

test("changing the stage from the header is recorded in the history", async () => {
  await page.getByRole("combobox", { name: t.leads.detail.stage }).click()
  await page.getByRole("option", { name: "Negociere" }).click()
  await expect(page.getByText(t.leads.detail.stageChanged)).toBeVisible()
  await page.getByRole("tab", { name: t.workspace.history }).click()
  await expect(page.getByText("Etapă schimbată: Lead nou → Negociere")).toBeVisible()
})

test("the contact page lists the lead", async () => {
  await page.getByRole("link", { name: /Mihai Lungu/ }).click()
  await expect(page).toHaveURL(/\/contacts\/[0-9a-f-]{36}$/)
  await expect(page.getByRole("link", { name: "Fișă E2E" })).toBeVisible()
})
