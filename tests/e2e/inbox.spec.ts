import { expect, test, type Page } from "@playwright/test"

import messages from "../../messages/ro.json"

import { hasDatabase, signUpWithCompany, skipReason } from "./support"

// Criteriul Etapei 8: mesaj intrat (webhook) → contact identificat → conversație în Inbox,
// apoi răspuns, notă internă, răspuns rapid, lead din conversație, actualizare în timp real.
test.describe.configure({ mode: "serial" })
test.skip(!hasDatabase, skipReason)

const t = messages
let page: Page
let channelId = ""
let secret = ""

function postWebhook(body: object, key = secret) {
  return page.request.post("/api/webhooks/internal", {
    headers: { authorization: `Bearer ${key}`, "x-channel-id": channelId },
    data: body,
  })
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  await signUpWithCompany(page, "inbox", `Inbox E2E ${Date.now()}`)
})

test.afterAll(async () => {
  await page?.close()
})

test("prepares a contact, a quick reply and the webhook key", async () => {
  await page.goto("/contacts")
  await page.getByRole("button", { name: t.contacts.create }).click()
  let dialog = page.getByRole("dialog")
  await dialog.getByLabel(t.contacts.form.firstName, { exact: true }).fill("Elena")
  await dialog.getByLabel(t.contacts.form.lastName, { exact: true }).fill("Clientă")
  await dialog.getByLabel(`${t.contacts.form.phones} 1`).fill("069 222 333")
  await dialog.getByRole("button", { name: t.contacts.form.save }).click()
  await expect(page.getByText(t.contacts.form.created)).toBeVisible()

  await page.goto("/settings/quick-replies")
  await page.getByRole("button", { name: t.settings.quickReplies.create }).click()
  dialog = page.getByRole("dialog")
  await dialog.getByLabel(t.settings.quickReplies.name).fill("Salut")
  await dialog.getByLabel(t.settings.quickReplies.shortcut).fill("salut")
  await dialog.getByLabel(t.settings.quickReplies.body).fill("Bună ziua! Cu ce vă putem ajuta?")
  await dialog.getByRole("button", { name: t.common.save }).click()
  await expect(page.getByText(t.settings.quickReplies.saved)).toBeVisible()

  await page.goto("/settings/channels")
  channelId = (await page
    .locator("code")
    .filter({ hasText: /^[0-9a-f-]{36}$/ })
    .first()
    .textContent())!
  await page.getByRole("button", { name: t.settings.channels.rotate }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: t.settings.channels.rotate })
    .click()
  dialog = page.getByRole("dialog", { name: t.settings.channels.secretTitle })
  secret = (await dialog.locator("code").textContent())!
  expect(secret).toMatch(/^whk_/)
  await page.keyboard.press("Escape")
})

test("an incoming message identifies the contact and opens a conversation", async () => {
  expect(
    (
      await postWebhook({ id: "e2e-1", sender: { phone: "+37369222333" }, text: "x" }, "gresit")
    ).status()
  ).toBe(401)

  const body = {
    id: "e2e-1",
    sender: { name: "Elena", phone: "+373 69 222 333" },
    text: "Aș dori o ofertă",
  }
  const first = await postWebhook(body)
  expect(first.status()).toBe(200)
  const result = (await first.json()).results[0]
  expect(result.contact_created).toBe(false)
  expect((await (await postWebhook(body)).json()).duplicate).toBe(true)

  await page.goto("/inbox")
  const item = page.getByRole("link", { name: /Elena Clientă/ })
  await expect(item).toContainText("Aș dori o ofertă")
  await expect(item.getByLabel(/1 mesaj necitit/)).toBeVisible()
  await item.click()

  await expect(page).toHaveURL(new RegExp(`/inbox/${result.conversation_id}`))
  await expect(
    page.locator("[data-direction=in]").filter({ hasText: "Aș dori o ofertă" })
  ).toBeVisible()
  const panel = page.getByRole("complementary", { name: t.inbox.panel.title })
  await expect(panel.getByRole("link", { name: "Elena Clientă" })).toBeVisible()
  await expect(item.getByLabel(/necitit/)).toHaveCount(0)
})

test("replies with a quick reply and adds an internal note", async () => {
  const composer = page.getByRole("textbox", { name: t.inbox.composer.placeholder.reply })
  await composer.fill("/sal")
  await page.getByRole("button", { name: /\/salut/ }).click()
  await expect(composer).toHaveValue("Bună ziua! Cu ce vă putem ajuta?")
  await composer.press("Enter")
  await expect(
    page
      .locator("[data-direction=out][data-kind=message]")
      .filter({ hasText: "Cu ce vă putem ajuta" })
  ).toBeVisible()

  await page.getByRole("tab", { name: t.inbox.composer.note }).click()
  await page
    .getByRole("textbox", { name: t.inbox.composer.placeholder.note })
    .fill("Client nou, de sunat mâine")
  await page.getByRole("button", { name: t.inbox.composer.send.note }).click()
  const note = page.locator("[data-kind=internal_note]")
  await expect(note).toContainText("Client nou, de sunat mâine")
  await expect(note).toContainText(t.inbox.message.note)
})

test("shows new messages in real time", async () => {
  await postWebhook({ id: "e2e-2", sender: { phone: "069222333" }, text: "Mesaj în timp real" })
  await expect(
    page.locator("[data-direction=in]").filter({ hasText: "Mesaj în timp real" })
  ).toBeVisible({
    timeout: 15_000,
  })
})

test("creates a lead from the conversation", async () => {
  const panel = page.getByRole("complementary", { name: t.inbox.panel.title })
  await panel.getByRole("button", { name: t.inbox.panel.createLead }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByLabel(t.inbox.panel.leadTitle)).toHaveValue("Elena Clientă")
  await dialog.getByLabel(t.inbox.panel.leadTitle).fill("Ofertă Elena")
  await dialog.getByRole("button", { name: t.common.save }).click()
  await expect(page.getByText(t.inbox.panel.leadCreated)).toBeVisible()
  await panel.getByRole("link", { name: "Ofertă Elena" }).click()

  await expect(page).toHaveURL(/\/leads\//)
  await page.getByRole("tab", { name: /Conversații \(1\)/ }).click()
  await expect(
    page.getByRole("link", { name: /Elena/ }).filter({ hasText: "Mesaj în timp real" })
  ).toBeVisible()
})
