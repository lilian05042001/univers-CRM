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
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /import-export\.spec\.ts/,
    },
    // Importul a 10 000 de contacte încarcă baza de date: rulează după celelalte teste, nu în paralel cu ele.
    {
      name: "bulk",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /import-export\.spec\.ts/,
      dependencies: ["desktop"],
    },
    // Pe telefon: paginile publice; fluxurile autentificate (serial, utilizator nou) doar pe desktop.
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /public\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${port}`,
    // Toate testele se autentifică de pe localhost: limita pe IP e ridicată doar aici.
    env: { NEXT_PUBLIC_APP_URL: `http://localhost:${port}`, AUTH_RATE_LIMIT_PER_IP: "10000" },
    url: `http://localhost:${port}/dashboard`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})
