import { expect, test, type Locator, type Page } from "@playwright/test"

import messages from "../../messages/ro.json"

import { hasDatabase, signUpWithCompany, skipReason } from "./support"

// Criteriul Etapei 5: mutarea pe tablă persistă și apare în istoric; „Pierdut” cere motivul.
test.describe.configure({ mode: "serial" })
test.skip(!hasDatabase, skipReason)

const t = messages
let page: Page

/** Răspunsul Server Action-ului care salvează mutarea (POST pe pagina curentă). */
const actionSaved = () =>
  page.waitForResponse((r) => r.request().method() === "POST" && r.ok(), { timeout: 15_000 })

/** Tragere reală cu mouse-ul (dnd-kit pornește după câțiva pixeli de mișcare). */
async function drag(source: Locator, target: Locator) {
  const from = (await source.boundingBox())!
  const to = (await target.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 4 })
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 20 })
  await page.mouse.up()
}

/**
 * Trage până când rezultatul apare: imediat după încărcare tabla poate să nu fie încă
 * hidratată (dnd-kit nu ascultă evenimentele), iar prima tragere s-ar pierde.
 */
async function dragUntil(title: string, target: string, done: () => Promise<void>) {
  await expect(async () => {
    await drag(card(title), column(target))
    await done()
  }).toPass({ timeout: 20_000 })
}

const column = (name: string) => page.getByRole("region", { name, exact: true })
const card = (title: string) => page.getByRole("button", { name: new RegExp(title) })

test.beforeAll(async ({ browser }) => {
  // Toate cele 8 coloane vizibile, ca mouse-ul să poată ajunge la oricare.
  page = await browser.newPage({ viewport: { width: 2800, height: 900 } })
  await signUpWithCompany(page, "board", `Board E2E ${Date.now()}`)
})

test.afterAll(async () => {
  await page?.close()
})

test("a new lead appears in the first column", async () => {
  await page.goto("/pipeline")
  await page.getByRole("button", { name: t.leads.create }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel(t.leads.form.title).fill("Kanban E2E")
  await dialog.getByLabel(t.leads.form.value).fill("5000")
  await dialog.getByRole("button", { name: t.leads.form.save }).click()
  await expect(page.getByText(t.leads.form.created)).toBeVisible()

  await expect(column("Lead nou").getByText("Kanban E2E")).toBeVisible()
  await expect(column("Lead nou").getByTestId("stage-count")).toHaveText("1")
})

test("dragging a card moves the lead and persists", async () => {
  const saved = actionSaved()
  await dragUntil("Kanban E2E", "Contactat", () =>
    expect(column("Contactat").getByText("Kanban E2E")).toBeVisible({ timeout: 2000 })
  )
  await expect(column("Contactat").getByTestId("stage-count")).toHaveText("1")
  await expect(column("Lead nou").getByTestId("stage-count")).toHaveText("0")

  // Mutarea se salvează asincron: reîncărcarea abia după răspunsul Server Action-ului.
  await saved
  await page.reload()
  await expect(column("Contactat").getByText("Kanban E2E")).toBeVisible()
  await expect(column("Contactat").getByTestId("stage-total")).toContainText("5.000")
})

test("moving to Lost asks for the reason", async () => {
  const dialog = page.getByRole("dialog")
  await dragUntil("Kanban E2E", "Pierdut", () =>
    expect(dialog.getByText(t.leads.loss.title)).toBeVisible({ timeout: 2000 })
  )
  await dialog.getByRole("combobox").click()
  await page.getByRole("option", { name: "Preț prea mare" }).click()
  const saved = actionSaved()
  await dialog.getByRole("button", { name: t.leads.loss.confirm }).click()
  await saved
  await page.reload()
  await expect(column("Pierdut").getByText("Kanban E2E")).toBeVisible()
})

test("cancelling the reason keeps the lead where it was", async () => {
  const saved = actionSaved()
  await dragUntil("Kanban E2E", "Negociere", () =>
    expect(column("Negociere").getByText("Kanban E2E")).toBeVisible({ timeout: 2000 })
  )
  await saved
  await page.reload()
  await dragUntil("Kanban E2E", "Pierdut", () =>
    expect(page.getByRole("dialog").getByText(t.leads.loss.title)).toBeVisible({ timeout: 2000 })
  )
  await page.getByRole("dialog").getByRole("button", { name: t.leads.loss.cancel }).click()
  await expect(column("Negociere").getByText("Kanban E2E")).toBeVisible()
})

test("admin adds a stage in settings", async () => {
  await page.goto("/settings/pipelines")
  await page.getByRole("button", { name: t.settings.pipelines.createStage }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel(t.settings.pipelines.stageName).fill("Demo E2E")
  await dialog.getByRole("button", { name: t.common.save }).click()
  await expect(page.getByText(t.settings.pipelines.stageSaved)).toBeVisible()

  await page.goto("/pipeline")
  await expect(column("Demo E2E")).toBeVisible()
})
