import { expect, test, type Page } from "@playwright/test"

import messages from "../../messages/ro.json"

import { hasDatabase, signUpWithCompany, skipReason } from "./support"

// Criteriul Etapei 7: notificare generată pentru o sarcină întârziată
// (job pg_cron la fiecare minut → Realtime → clopoțel), sarcini și calendar.
test.describe.configure({ mode: "serial" })
test.skip(!hasDatabase, skipReason)

const t = messages
let page: Page

/** Data locală (Europe/Chisinau) cu n zile față de azi, ca „YYYY-MM-DD”. */
function localDate(offsetDays: number) {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Chisinau" }).format(d)
}
const yesterday = localDate(-1)
const nextWeek = localDate(7)

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await signUpWithCompany(page, "tasks", `Tasks E2E ${Date.now()}`)
})

test.afterAll(async () => {
  await page?.close()
})

test("an overdue task appears in the Overdue tab", async () => {
  await page.goto("/tasks")
  await page.getByRole("button", { name: t.tasks.create }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel(t.tasks.form.title).fill("Sună clientul E2E")
  await dialog.getByLabel(t.tasks.form.dueAt).fill(`${yesterday}T10:00`)
  await dialog.getByRole("button", { name: t.common.save }).click()
  await expect(page.getByText(t.tasks.created)).toBeVisible()

  await page.getByRole("tab", { name: /Întârziate \(1\)/ }).click()
  await expect(page.getByText("Sună clientul E2E")).toBeVisible()
  await expect(page.getByText(t.tasks.statuses.overdue)).toBeVisible()
})

test("the overdue notification arrives in the bell", async () => {
  test.setTimeout(120_000)
  // Job-ul rulează la fiecare minut; notificarea vine prin Realtime, fără reîncărcare.
  await expect(page.getByRole("button", { name: /Notificări \(1 necitite\)/ })).toBeVisible({
    timeout: 90_000,
  })

  await page.getByRole("button", { name: /Notificări/ }).click()
  await page.getByRole("menuitem", { name: /Sarcină întârziată.*Sună clientul E2E/ }).click()
  await expect(page).toHaveURL(/\/tasks$/)
  await expect(page.getByRole("button", { name: "Notificări", exact: true })).toBeVisible()
})

test("the task is shown in the calendar and can be rescheduled by dragging", async () => {
  await page.goto(`/calendar?date=${yesterday}`)
  const chip = page.getByRole("button", { name: /10:00 Sună clientul E2E/ })
  await expect(chip).toBeVisible()

  const target = page.locator(`[data-date="${nextWeek}"]`)
  if (!(await target.isVisible())) await page.getByRole("button", { name: t.calendar.next }).click()
  const from = (await chip.boundingBox())!
  const to = (await page.locator(`[data-date="${nextWeek}"]`).boundingBox())!
  await expect(async () => {
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + 4, { steps: 3 })
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 })
    await page.mouse.up()
    await expect(page.getByText(t.calendar.rescheduled)).toBeVisible({ timeout: 2000 })
  }).toPass({ timeout: 20_000 })

  await page.goto(`/tasks?view=upcoming`)
  await expect(page.getByText("Sună clientul E2E")).toBeVisible()
})
