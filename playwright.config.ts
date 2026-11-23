import { defineConfig, devices } from "@playwright/test"

/**
 * Configuração da suíte End-to-End.
 *
 * A suíte usa PORTAS DEDICADAS (padrão 8001/3001/8002) e nunca reaproveita
 * servidores de desenvolvimento: reutilizar o backend da aplicação faria os
 * testes gravarem no banco real. O backend é iniciado com `settings_e2e`
 * (SQLite isolado). Todas as portas e caminhos podem ser sobrescritos por
 * variáveis de ambiente para que duas suítes rodem ao mesmo tempo sem
 * conflito — use `scripts/run-e2e-isolated.sh`.
 */
const backendPort = Number(process.env.E2E_BACKEND_PORT ?? 8001)
const frontendPort = Number(process.env.E2E_FRONTEND_PORT ?? 3001)
const workerPort = Number(process.env.E2E_WORKER_PORT ?? 8002)
const runId = process.env.E2E_RUN_ID ?? String(process.pid)
const dbName = process.env.E2E_DB_NAME ?? `e2e-${runId}.sqlite3`
const mediaRoot = process.env.E2E_MEDIA_ROOT ?? `/tmp/opencode/e2e-media-${runId}`

if (!process.env.E2E_API_URL) {
  process.env.E2E_API_URL = `http://localhost:${backendPort}/api/v1`
}

const backendEnv = {
  DJANGO_SETTINGS_MODULE: "thesismanagerbackend.settings_e2e",
  E2E_RUN_ID: runId,
  E2E_FRONTEND_PORT: String(frontendPort),
  E2E_DB_NAME: dbName,
  E2E_MEDIA_ROOT: mediaRoot,
}

export default defineConfig({
  testDir: "./e2e",
  outputDir: `test-results-${runId}`,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: `playwright-report-${runId}` }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${frontendPort}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    // Usa o Chromium gerenciado pelo Playwright por padrão. Defina
    // E2E_BROWSER_CHANNEL=chrome para usar o Google Chrome do sistema.
    ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}),
  },
  projects: [
    {
      name: "chromium",
    },
  ],
  webServer: [
    {
      command:
        `cd ../thesis-manager-ufvjm-backend && rm -f '${dbName}' '${dbName}-wal' '${dbName}-shm' && rm -rf '${mediaRoot}' && ` +
        ".venv/bin/python manage.py migrate --noinput && " +
        `.venv/bin/python manage.py runserver 127.0.0.1:${backendPort} --noreload`,
      env: backendEnv,
      url: `http://localhost:${backendPort}/health`,
      // Nunca reutilizar um servidor alheio: isso gravaria no banco real.
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `PORT=${frontendPort} REACT_APP_API_BASE_URL=http://localhost:${backendPort} BROWSER=none npm start`,
      url: `http://localhost:${frontendPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // Processa PDFs de teste em segundo plano: a API exige extração de texto
      // concluída antes de aceitar uma nova versão do mesmo arquivo.
      command:
        "cd ../thesis-manager-ufvjm-backend && " +
        "bash -c 'while true; do DJANGO_SETTINGS_MODULE=thesismanagerbackend.settings_e2e " +
        ".venv/bin/python manage.py extract_thesis_text --limit 20 >/dev/null 2>&1; sleep 1; done & " +
        `WORKER=$!; trap "kill $WORKER" EXIT; python3 -m http.server ${workerPort} >/dev/null 2>&1'`,
      env: backendEnv,
      url: `http://localhost:${workerPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
