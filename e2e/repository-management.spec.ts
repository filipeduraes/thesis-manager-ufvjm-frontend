import { expect, test } from "@playwright/test"
import { loginAs, navigateTo, uniqueEmail } from "./helpers/auth"
import { seedAcademicContext, seedPublishedThesis, uniquePdfBuffer } from "./helpers/seed"

const API_ROOT = process.env.E2E_API_URL ?? "http://localhost:8001/api/v1"

async function openThesis(page: import("@playwright/test").Page, title: string): Promise<void> {
  await navigateTo(page, "Monografias")
  await page.getByPlaceholder("Buscar aluno, título ou referência...").fill(title)
  await page.getByRole("button", { name: "Filtrar" }).click()
  await page.getByRole("button", { name: new RegExp(title) }).first().click()
}

test.describe("Gestão do repositório público", () => {
  test("cadastra uma monografia de acervo e a publica", async ({ page, request }) => {
    const academic = await seedAcademicContext(request)
    const title = `Acervo E2E ${Date.now()}`
    await loginAs(page, "Admin Acervo E2E", uniqueEmail("admin-acervo"), ["ADMIN"])
    await navigateTo(page, "Monografias")
    await page.getByRole("button", { name: "Cadastrar monografia do acervo" }).click()

    await page.getByLabel("Título").fill(title)
    await page.getByLabel("Resumo").fill("Resumo do trabalho de acervo.")
    await page.getByLabel("Palavras-chave").fill("acervo, e2e")
    await page.getByRole("combobox", { name: "Autor 1 (principal)" }).fill("Autor Acervo E2E")
    await page.getByLabel("Curso").selectOption(academic.courseId)
    await page.getByLabel("Ano de defesa").fill("2019")
    await page.getByPlaceholder("Digite o nome ou o e-mail do orientador").fill(academic.advisorEmail)
    await page.getByRole("option", { name: new RegExp(academic.advisorEmail) }).click()
    await page.locator("#legacy-file").setInputFiles({ name: "acervo-e2e.pdf", mimeType: "application/pdf", buffer: await uniquePdfBuffer() })
    await page.getByRole("button", { name: "Cadastrar e publicar" }).click()

    await expect(page.getByRole("status").filter({ hasText: "Monografia cadastrada e publicada" })).toBeVisible({ timeout: 15000 })
    const response = await request.get(`${API_ROOT}/public/theses`, { params: { q: title } })
    expect(response.ok()).toBeTruthy()
    expect((await response.json()).count).toBe(1)
  })

  test("edita os metadados de uma monografia publicada", async ({ page, request }) => {
    const seeded = await seedPublishedThesis(request, `Edição E2E ${Date.now()}`)
    await loginAs(page, "Coord Edição E2E", seeded.coordinatorEmail, ["COORDINATOR"])
    await openThesis(page, seeded.title)
    await page.getByRole("button", { name: "Editar metadados" }).click()
    const dialog = page.getByRole("dialog", { name: "Editar metadados publicados" })
    const newTitle = `${seeded.title} revisado`
    await dialog.getByLabel("Título").fill(newTitle)
    await dialog.getByRole("button", { name: "Salvar alterações" }).click()
    await expect(page.getByText(newTitle).first()).toBeVisible({ timeout: 15000 })
    const response = await request.get(`${API_ROOT}/public/theses`, { params: { q: newTitle } })
    expect((await response.json()).count).toBe(1)
  })

  test("despublica uma monografia e a remove do repositório", async ({ page, request }) => {
    const seeded = await seedPublishedThesis(request, `Despublicação E2E ${Date.now()}`)
    await loginAs(page, "Coord Despublicação E2E", seeded.coordinatorEmail, ["COORDINATOR"])
    await openThesis(page, seeded.title)
    await page.getByRole("button", { name: "Despublicar" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Motivo da despublicação").fill("Teste end-to-end de despublicação.")
    await dialog.getByRole("button", { name: "Confirmar despublicação" }).click()
    await expect(page.getByText("Monografia despublicada e arquivada").first()).toBeVisible({ timeout: 15000 })
    const response = await request.get(`${API_ROOT}/public/theses`, { params: { q: seeded.title } })
    expect((await response.json()).count).toBe(0)
  })
})
