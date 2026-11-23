/**
 * Smoke ponta a ponta no stack real (Docker Compose), sem servidores de teste.
 *
 * Backend :8000, frontend :3000 e Mailpit :8025. Prova o fluxo completo do
 * convite externo: API → evento → consumidor → e-mail → token → sessão externa.
 * Requer o stack padrão do Compose (`docker compose up`) com o frontend em
 * `npm start`, ou `./scripts/smoke-stack.sh` para um stack descartável.
 */
import { expect, test } from "@playwright/test"
import { loginAs, uniqueEmail } from "./helpers/auth"
import { devLogin, seedInProgressDefense } from "./helpers/seed"

const API_ROOT = process.env.E2E_API_URL ?? "http://localhost:8000/api/v1"
const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025"
const TOKEN_PATTERN = /UFVJM(?:-[A-Z0-9]{4}){4}/

test("convite externo chega ao Mailpit e o token abre a sessão", async ({ page, request }) => {
  // Já cria curso, tese aprovada e banca agendada com um avaliador institucional.
  const seeded = await seedInProgressDefense(request, `Smoke real ${Date.now()}`)

  const coordinator = await devLogin(request, "Coordenador Smoke", seeded.thesis.coordinatorEmail, "COORDINATOR")
  const headers = { "X-CSRFToken": coordinator.csrfToken }
  const defenseId = seeded.defenseId

  const externalEmail = uniqueEmail("convidado-smoke")
  const externalName = "Convidado Smoke Real"
  const memberResponse = await request.post(`${API_ROOT}/defenses/${defenseId}/members/external`, {
    headers,
    data: { role: "MEMBER", name: externalName, email: externalEmail, institution: "UFVJM" },
  })
  expect(memberResponse.status(), await memberResponse.text()).toBe(201)
  expect((await memberResponse.json()).accessToken).toBeUndefined()

  // O consumidor do Compose publica o evento e envia o e-mail ao Mailpit.
  await expect
    .poll(async () => {
      const response = await request.get(`${MAILPIT}/api/v1/messages`)
      if (!response.ok()) return 0
      const body = (await response.json()) as { messages?: Array<{ To?: Array<{ Address?: string }>; Text?: string }> }
      return (body.messages ?? []).filter((message) => message.To?.some((to) => to.Address === externalEmail)).length
    }, { timeout: 30_000, intervals: [1000] })
    .toBeGreaterThan(0)

  const inbox = (await (await request.get(`${MAILPIT}/api/v1/messages`)).json()) as {
    messages: Array<{ ID: string; To?: Array<{ Address?: string }> }>
  }
  const messageId = inbox.messages.find((item) => item.To?.some((to) => to.Address === externalEmail))?.ID
  const detail = (await (await request.get(`${MAILPIT}/api/v1/message/${messageId}`)).json()) as { Text?: string; HTML?: string }
  const token = detail.Text?.match(TOKEN_PATTERN)?.[0]
  expect(token, "token legível apenas no e-mail").toBeTruthy()

  // A UI real reflete o convite para quem gerencia a banca.
  await loginAs(page, "Coordenador Smoke", seeded.thesis.coordinatorEmail, ["COORDINATOR"])
  await page.getByRole("button", { name: "Bancas" }).click()
  await page.getByRole("tab", { name: /Bancas/ }).click()
  const defenseLink = page.getByText(seeded.thesis.title).first()
  await expect(defenseLink).toBeVisible({ timeout: 15_000 })
  await page.getByRole("button", { name: "Gerenciar banca" }).first().click()
  await expect(page.getByText(new RegExp(externalName)).first()).toBeVisible({ timeout: 15_000 })

  // O token do e-mail abre a sessão externa na API real.
  const csrf = (await page.context().cookies()).find((cookie) => cookie.name === "csrftoken")?.value ?? ""
  const exchange = await page.request.post(`${API_ROOT}/auth/external-token`, {
    headers: { "X-CSRFToken": csrf },
    data: { token },
  })
  expect(exchange.status(), await exchange.text()).toBe(200)
  expect(((await exchange.json()) as { authenticated?: boolean }).authenticated).toBe(true)
})
