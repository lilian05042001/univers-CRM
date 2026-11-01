import { existsSync } from "node:fs"

import { defineConfig, devices } from "@playwright/test"

// Testele au nevoie de aceleași variabile ca aplicația (URL Supabase, cheia secretă pentru Admin API).
if (existsSync(".env.local")) process.loadEnvFile(".env.local")

const port = 3100

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "ro-RO",
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // Fluxurile autentificate (serial, cu un utilizator nou) rulează doar pe desktop.
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: /(app|crm|pipeline|detail)\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${port}`,
    env: { NEXT_PUBLIC_APP_URL: `http://localhost:${port}` },
    url: `http://localhost:${port}/dashboard`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})
