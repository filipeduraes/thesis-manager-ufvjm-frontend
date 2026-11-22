import { defineConfig, devices } from "@playwright/test"

/**
 * Configuração da suíte End-to-End.
 *
 * A suíte usa PORTAS DEDICADAS (8001/3001) e nunca reaproveita servidores de
 * desenvolvimento: reutilizar o backend da aplicação faria os testes gravarem
 * no banco real. O backend é iniciado com `settings_e2e` (SQLite isolado).
 * O frontend não possui roteamento por URL, então os testes sempre começam em
 * "/" e navegam pelos menus laterais.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    channel: "chrome",
  },
  projects: [
    {
      name: "chromium",
    },
  ],
  webServer: [
    {
      command:
        "cd ../thesis-manager-ufvjm-backend && " +
        "rm -f e2e.sqlite3 && rm -rf /tmp/opencode/e2e-media && " +
        "DJANGO_SETTINGS_MODULE=thesismanagerbackend.settings_e2e .venv/bin/python manage.py migrate --noinput && " +
        "DJANGO_SETTINGS_MODULE=thesismanagerbackend.settings_e2e .venv/bin/python manage.py runserver 127.0.0.1:8001 --noreload",
      url: "http://localhost:8001/health",
      // Nunca reutilizar um servidor alheio: isso gravaria no banco real.
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "PORT=3001 REACT_APP_API_BASE_URL=http://localhost:8001 BROWSER=none npm start",
      url: "http://localhost:3001",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
