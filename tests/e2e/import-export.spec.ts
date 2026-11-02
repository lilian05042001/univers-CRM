import { expect, test, type Page } from "@playwright/test"

import messages from "../../messages/ro.json"

import { hasDatabase, signUpWithCompany, skipReason } from "./support"

// Etapa 11: import 10 000 de contacte fără blocarea interfeței, raport de erori, export CSV, chei API + API v1.
test.describe.configure({ mode: "serial" })
test.skip(!hasDatabase, skipReason)

const t = messages
const ROWS = 10_000
let page: Page

/** 9 997 rânduri bune, un duplicat (telefonul rândului 2) și două e-mailuri greșite (rândurile 101 și 5001). */
function contactsCsv() {
  const lines = ["Prenume;Nume de familie;Telefon;E-mail;Oraș"]
  for (let i = 0; i < ROWS; i++) {
    const phone = i === ROWS - 1 ? "+37360000000" : `+3736${String(i).padStart(7, "0")}`
    const email = i === 99 || i === 4999 ? "nu-e-email" : `contact${i}@import.test`
    lines.push(`Contact;Import ${i};${phone};${email};Chișinău`)
  }
  return Buffer.from(`﻿${lines.join("\r\n")}\r\n`, "utf-8")
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  await signUpWithCompany(page, "imp", `Import E2E ${Date.now()}`)
})

test.afterAll(async () => {
  await page?.close()
})

test("imports 10 000 contacts in batches while the page stays responsive", async () => {
  test.setTimeout(300_000)
  await page.goto("/settings/import-export")
  // Câmpul de fișier nu reîncearcă: selecția se face după hidratare.
  await page.waitForLoadState("networkidle")
  await page.getByLabel(t.importExport.file.label).setInputFiles({
    name: "contacte.csv",
    mimeType: "text/csv",
    buffer: contactsCsv(),
  })

  // Maparea automată recunoaște antetele (inclusiv „Oraș”, cu diacritice).
  await expect(page.getByRole("combobox", { name: /Telefon$/ })).toHaveText(
    t.importExport.fields.phone
  )
  await expect(page.getByRole("combobox", { name: /Oraș$/ })).toHaveText(t.importExport.fields.city)
  await page.getByRole("button", { name: /^Importă/ }).click()

  const processed = page.getByTestId("import-processed")
  await expect(processed).toContainText(/^[1-9][\d.]* din 10\.000/, { timeout: 60_000 })

  // În timpul importului, firul principal răspunde: un cadru de animație se desenează imediat.
  const frameMs = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const start = performance.now()
        requestAnimationFrame(() => resolve(performance.now() - start))
      })
  )
  expect(frameMs).toBeLessThan(500)
  await expect(page.getByText(t.importExport.progress.running)).toBeVisible()

  await expect(page.getByText(t.importExport.progress.done)).toBeVisible({ timeout: 240_000 })
  await expect(processed).toContainText("10.000 din 10.000")
  await expect(page.locator("[data-stat=ok] dd")).toHaveText("9997")
  await expect(page.locator("[data-stat=skipped] dd")).toHaveText("1")
  await expect(page.locator("[data-stat=failed] dd")).toHaveText("2")
})

test("the error report lists the rejected rows", async () => {
  const download = page.waitForEvent("download")
  await page.getByRole("link", { name: t.importExport.progress.errorReport }).click()
  const file = await download
  const text = await (
    await file.createReadStream()
  )
    .toArray()
    .then((c) => Buffer.concat(c).toString())
  expect(text).toContain(`101;${t.importExport.fields.email};${t.validation.email}`)
  expect(text).toContain(`5001;${t.importExport.fields.email};${t.validation.email}`)
  expect(text).toContain(`10001;;${t.importExport.errors.duplicate}`)
})

test("the imported contacts appear in the list and in the history", async () => {
  await page.reload()
  const history = page.getByRole("row", { name: /contacte\.csv/ })
  await expect(history).toContainText(t.importExport.history.statuses.done)
  await expect(history).toContainText("9997")

  await page.goto("/contacts?q=Import%204242")
  await expect(page.getByRole("row", { name: /Contact Import 4242/ })).toBeVisible()
  await page.goto("/contacts")
  // În română, numerele de 4 cifre nu au separator de mii.
  await expect(page.getByText(/din 9997$/)).toBeVisible()
})

test("exports the filtered contact list as CSV", async () => {
  await page.goto("/contacts?q=Import%20777")
  await expect(page.getByRole("row", { name: /Contact Import 777/ }).first()).toBeVisible()
  const download = page.waitForEvent("download")
  await page.getByRole("link", { name: t.table.export }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^contacte-\d{4}-\d{2}-\d{2}\.csv$/)
  const text = await (
    await file.createReadStream()
  )
    .toArray()
    .then((c) => Buffer.concat(c).toString())
  const lines = text.trim().split("\r\n")
  expect(lines[0]).toContain(
    `${t.importExport.fields.first_name};${t.importExport.fields.last_name}`
  )
  expect(
    lines.some((l) => l.startsWith("Contact;Import 777;+37360000777;contact777@import.test"))
  ).toBe(true)
})

test("an API key reads and writes data until it is revoked", async () => {
  await page.goto("/settings/api")
  await page.getByRole("button", { name: t.integrations.api.create }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel(t.integrations.api.name).fill("Site E2E")
  await dialog.getByLabel(t.integrations.api.scopeLabels.leads_write).check()
  await dialog.getByRole("button", { name: t.common.save }).click()
  const secretDialog = page.getByRole("dialog", { name: t.integrations.api.secretTitle })
  const secret = (await secretDialog.locator("code").textContent()) ?? ""
  expect(secret).toMatch(/^ucrm_[\w-]{43}$/)
  await page.keyboard.press("Escape")

  const headers = { Authorization: `Bearer ${secret}` }
  const list = await page.request.get("/api/v1/contacts?limit=1&q=Import%204242", { headers })
  expect(list.status()).toBe(200)
  const listBody = await list.json()
  expect(listBody.pagination.total).toBe(1)
  expect(listBody.data[0]).toMatchObject({
    last_name: "Import 4242",
    emails: ["contact4242@import.test"],
  })

  const created = await page.request.post("/api/v1/leads", {
    headers,
    data: { title: "Lead din API", value: 1500, contact_ids: [listBody.data[0].id] },
  })
  expect(created.status()).toBe(201)
  const lead = (await created.json()).data
  expect(lead).toMatchObject({
    title: "Lead din API",
    status: "open",
    value: 1500,
    currency: "MDL",
  })

  const forbidden = await page.request.post("/api/v1/contacts", {
    headers,
    data: { first_name: "X" },
  })
  expect(forbidden.status()).toBe(403)
  const invalid = await page.request.post("/api/v1/leads", { headers, data: { value: 10 } })
  expect(invalid.status()).toBe(422)

  await page.goto(`/leads/${lead.id}`)
  await expect(page.getByRole("heading", { name: "Lead din API" })).toBeVisible()

  await page.goto("/settings/api")
  await page.getByRole("button", { name: t.integrations.api.revoke }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: t.integrations.api.revoke })
    .click()
  await expect(page.getByText(t.integrations.api.status.revoked)).toBeVisible()
  const revoked = await page.request.get("/api/v1/contacts", { headers })
  expect(revoked.status()).toBe(401)
})
