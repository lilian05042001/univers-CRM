import { expect, test, type Page } from "@playwright/test"

import messages from "../../messages/ro.json"

import { hasDatabase, signUpWithCompany, skipReason } from "./support"

// Criteriul Etapei 9: automatizare din șablon → eveniment → worker (/api/jobs) → acțiune + istoric.
test.describe.configure({ mode: "serial" })
test.skip(!hasDatabase || !process.env.CRON_SECRET, skipReason)

const t = messages
let page: Page

function runWorker(secret = process.env.CRON_SECRET) {
  return page.request.post("/api/jobs/automations", {
    headers: { authorization: `Bearer ${secret}` },
  })
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
  await signUpWithCompany(page, "auto", `Automatizări E2E ${Date.now()}`)
})

test.afterAll(async () => {
  await page?.close()
})

test("the job endpoint requires the cron secret", async () => {
  expect((await runWorker("gresit")).status()).toBe(401)
})

test("every template opens prefilled in the editor", async () => {
  for (const template of Object.values(t.automations.templates)) {
    await page.goto("/automations")
    await page.getByRole("link", { name: new RegExp(template.name) }).click()
    await expect(page.getByLabel(t.automations.editor.name)).toHaveValue(template.name)
  }
})

test("creates an automation from a template", async () => {
  await page.goto("/automations")
  await expect(page.getByText(t.automations.emptyTitle)).toBeVisible()
  await page
    .getByRole("link", { name: new RegExp(t.automations.templates.taskOnStage.name) })
    .click()

  await expect(page.getByLabel(t.automations.editor.name)).toHaveValue(
    t.automations.templates.taskOnStage.name
  )
  await page.getByRole("combobox", { name: t.automations.editor.stage }).click()
  await page.getByRole("option", { name: "Lead nou", exact: true }).click()
  await page.getByRole("button", { name: t.automations.editor.save }).click()

  await expect(page.getByText(t.automations.editor.saved)).toBeVisible()
  await expect(page).toHaveURL(/\/automations\/[0-9a-f-]{36}$/)
})

test("a new lead triggers the automation through the worker", async () => {
  await page.goto("/leads")
  await page.getByRole("button", { name: t.leads.create }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel(t.leads.form.title).fill("Lead automatizat")
  await dialog.getByRole("button", { name: t.leads.form.save }).click()
  await expect(page.getByText(t.leads.form.created)).toBeVisible()

  // Worker-ul poate fi pornit și de pg_cron; rezultatul trebuie să fie același (deduplicare).
  const first = await runWorker()
  expect(first.status()).toBe(200)
  const second = await (await runWorker()).json()
  expect(second.succeeded).toBe(0)

  await page.getByRole("row", { name: /Lead automatizat/ }).click()
  await page.getByRole("tab", { name: /Sarcini/ }).click()
  await expect(page.getByText(t.automations.templates.taskOnStage.task)).toHaveCount(1)
})

test("the run appears in the history", async () => {
  await page.goto("/automations/runs")
  const row = page.getByRole("row", { name: new RegExp(t.automations.templates.taskOnStage.name) })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText(t.automations.runs.status.success)
  await expect(row).toContainText(t.automations.actions.types.create_task)

  await page.goto("/automations")
  await expect(
    page.getByText(new RegExp(`^${t.automations.triggers.lead_stage_entered} →`))
  ).toBeVisible()
  await page.getByRole("switch").click()
  await expect(page.getByText(t.automations.deactivated)).toBeVisible()
})
