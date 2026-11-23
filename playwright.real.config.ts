import { defineConfig, devices } from "@playwright/test"

/**
 * Smoke ponta a ponta no stack isolado de teste (scripts/smoke-stack.sh).
 * Portas vêm das variáveis do script; os defaults permitem rodar contra o
 * stack de desenvolvimento se necessário.
 */
const backendPort = process.env.BACKEND_PORT ?? "8000"
const frontendPort = process.env.FRONTEND_PORT ?? "3000"
const mailpitPort = process.env.MAILPIT_PORT ?? "8025"

process.env.E2E_API_URL ??= `http://127.0.0.1:${backendPort}/api/v1`
process.env.E2E_BASE_URL ??= `http://127.0.0.1:${frontendPort}`
process.env.MAILPIT_URL ??= `http://127.0.0.1:${mailpitPort}`

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
    baseURL: process.env.E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [{ name: "chromium" }],
})
