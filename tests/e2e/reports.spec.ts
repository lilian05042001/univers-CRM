import { expect, test, type Page } from "@playwright/test"

import messages from "../../messages/ro.json"

import { hasDatabase, signUpWithCompany, skipReason } from "./support"

// Etapa 10: dashboard-ul și rapoartele reflectă datele, filtrele trec prin URL, exportul CSV.
test.describe.configure({ mode: "serial" })
test.skip(!hasDatabase, skipReason)

const t = messages
let page: Page

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  await signUpWithCompany(page, "rep", `Rapoarte E2E ${Date.now()}`)
})

test.afterAll(async () => {
  await page?.close()
})

test("the dashboard counts a new lead", async () => {
  await page.goto("/dashboard")
  const newLeads = page.locator("[data-kpi=newLeads]")
  await expect(newLeads).toContainText(t.dashboard.kpis.newLeads)
  await expect(newLeads).toContainText(/^\D*0$/)

  await page.goto("/leads")
  await page.getByRole("button", { name: t.leads.create }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel(t.leads.form.title).fill("Lead pentru raport")
  await dialog.getByLabel(t.leads.form.value).fill("12500")
  await dialog.getByRole("button", { name: t.leads.form.save }).click()
  await expect(page.getByText(t.leads.form.created)).toBeVisible()

  await page.goto("/dashboard")
  await expect(page.locator("[data-kpi=newLeads]")).toContainText(/^\D*1$/)
  await expect(page.locator("[data-kpi=activeLeads]")).toContainText(/^\D*1$/)
  await expect(page.locator("[data-kpi=pipelineValue]")).toContainText("12.500")
})

test("the period filter lives in the URL", async () => {
  await page.getByRole("combobox", { name: t.reports.periods.label }).click()
  await page.getByRole("option", { name: t.reports.periods.today }).click()
  await expect(page).toHaveURL(/period=today/)
  await expect(page.locator("[data-kpi=newLeads]")).toContainText(/^\D*1$/)
})

test("the funnel report shows the stage table", async () => {
  await page.goto("/reports/funnel")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(t.nav.reports)
  const firstStage = page.getByRole("row", { name: /Lead nou/ })
  await expect(firstStage).toContainText("1")
  await expect(firstStage).toContainText("100%")
})

test("exports the report as CSV", async () => {
  await page.goto("/reports/team")
  const download = page.waitForEvent("download")
  await page.getByRole("link", { name: t.reports.export }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^raport-team-.*\.csv$/)
  const csv = await (await file.createReadStream()).toArray()
  const text = Buffer.concat(csv).toString("utf8")
  expect(text.startsWith("﻿" + t.reports.columns.name)).toBe(true)
  expect(text).toContain(";12500")
})
