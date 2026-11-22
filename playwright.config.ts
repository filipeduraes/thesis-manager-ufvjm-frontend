import { defineConfig, devices } from "@playwright/test"

/**
 * Configuração da suíte End-to-End.
 *
 * Os testes rodam contra o servidor de desenvolvimento do frontend (CRA, porta
 * 3000) e o backend Django com DEBUG=True (porta 8000). O frontend não possui
 * roteamento por URL: a navegação é feita inteiramente pela interface, então a
 * suíte sempre começa em "/" e usa os menus laterais.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
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
  // Sobe automaticamente backend e frontend quando não estiverem rodando.
  // Em desenvolvimento, reaproveita servidores já abertos (ex.: docker compose).
  webServer: [
    {
      command:
        "cd ../thesis-manager-ufvjm-backend && " +
        "DJANGO_SETTINGS_MODULE=thesismanagerbackend.settings_e2e .venv/bin/python manage.py migrate --noinput && " +
        "DJANGO_SETTINGS_MODULE=thesismanagerbackend.settings_e2e .venv/bin/python manage.py runserver 127.0.0.1:8000 --noreload",
      url: "http://localhost:8000/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "BROWSER=none npm start",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
