import { expect, test } from "@playwright/test"
import { loginAs, navigateTo } from "./helpers/auth"
import { seedApprovedThesis } from "./helpers/seed"

function nextWeekDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString().slice(0, 10)
}

test.describe("Fluxo completo de banca", () => {
  test("orientador aprova e coordenador agenda a defesa com membro interno", async ({ page, request }) => {
    const thesis = await seedApprovedThesis(request, `TCC banca E2E ${Date.now()}`)

    // Etapa 1: parecer do orientador pela interface.
    await loginAs(page, "Orientador E2E Banca", thesis.advisorEmail, ["ADVISOR"])
    await navigateTo(page, "Orientandos")
    await page.getByPlaceholder("Buscar aluno, título ou referência...").fill(thesis.title)
    await page.getByRole("button", { name: "Filtrar" }).click()
    await page.getByRole("button", { name: new RegExp(thesis.title) }).first().click()
    await page.getByRole("button", { name: "Aprovar para banca" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar aprovação" }).click()
    await expect(page.getByRole("status").filter({ hasText: "Parecer de aprovação registrado." })).toBeVisible()

    // Etapa 2: troca de perfil e agendamento pelo coordenador.
    await page.getByRole("button", { name: "Sair" }).click()
    await loginAs(page, "Coord E2E Banca", thesis.coordinatorEmail, ["COORDINATOR"])
    await navigateTo(page, "Bancas")

    await page.getByRole("button", { name: "Selecionar" }).first().click()
    await page.getByRole("dialog").getByRole("button", { name: new RegExp(thesis.title) }).first().click()

    await page.getByLabel("Data").fill(nextWeekDate())
    await page.getByLabel("Horário de início").fill("14:00")
    await page.getByRole("button", { name: "1h30" }).click()
    await page.getByRole("radio", { name: "Presencial" }).click()
    await page.getByPlaceholder("Sala / prédio").fill("Sala E2E")

    await page.getByRole("button", { name: "Adicionar membro interno" }).click()
    const memberDialog = page.getByRole("dialog")
    await memberDialog.getByRole("combobox", { name: "Usuário ou e-mail institucional" }).fill(thesis.advisorEmail)
    await memberDialog.getByRole("option", { name: new RegExp(thesis.advisorEmail) }).click()
    await memberDialog.getByRole("combobox", { name: "Papel na banca" }).selectOption("PRESIDENT")
    await memberDialog.getByRole("button", { name: "Adicionar membro" }).click()

    await expect(page.getByText("Nenhum membro incluído.")).toHaveCount(0)
    await page.getByRole("button", { name: "Confirmar agendamento" }).click()

    // Após agendar, a aplicação abre a página de gerenciamento da banca.
    await expect(page.getByRole("heading", { name: "Status da banca" })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole("list", { name: "Etapas da banca" })).toContainText("Agendada")
    await expect(page.getByText("1 membro", { exact: true })).toBeVisible()

    // Volta à listagem pela navegação (breadcrumb) e confirma que o registro persisted.
    await page.getByRole("navigation", { name: "Caminho" }).getByRole("button", { name: "Bancas" }).click()
    await page.getByRole("tab", { name: /Bancas/ }).click()
    await page.getByRole("textbox", { name: "Buscar bancas" }).fill(thesis.title)
    await page.getByRole("button", { name: "Filtrar" }).click()
    await expect(page.getByText(thesis.title)).toBeVisible()
  })
})
