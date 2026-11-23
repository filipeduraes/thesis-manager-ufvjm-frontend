import { defineConfig, devices } from "@playwright/test"

/**
 * Smoke contra o stack real (docker compose), sem subir servidores de teste.
 * Backend em :8000, frontend em :3000 e Mailpit em :8025.
 */
process.env.E2E_API_URL ??= "http://localhost:8000/api/v1"

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results-real",
  testMatch: "smoke-real.spec.ts",
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 120_000,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "chromium" }],
})
