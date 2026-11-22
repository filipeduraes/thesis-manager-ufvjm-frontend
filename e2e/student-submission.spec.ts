import { expect, test } from "@playwright/test"
import { loginAs, navigateTo, uniqueEmail } from "./helpers/auth"
import { seedAcademicContext } from "./helpers/seed"

test.describe("Submissão de monografia (aluno)", () => {
  test("valida campos obrigatórios antes de salvar os metadados", async ({ page, request }) => {
    const academic = await seedAcademicContext(request)
    await loginAs(page, "Aluno E2E Form", uniqueEmail("student-form"), ["STUDENT"])
    await navigateTo(page, "Minha monografia")

    await page.getByRole("button", { name: "Salvar rascunho" }).click()
    await expect(page.getByRole("alert")).toHaveText("Informe o título da monografia.")

    await page.getByLabel("Título da monografia").fill("Título temporário")
    await page.getByRole("button", { name: "Salvar rascunho" }).click()
    await expect(page.getByRole("alert")).toHaveText("Informe o resumo da monografia.")

    await page.getByLabel("Resumo").fill("Resumo temporário")
    await page.getByRole("button", { name: "Salvar rascunho" }).click()
    await expect(page.getByRole("alert")).toHaveText("Informe pelo menos uma palavra-chave.")

    await page.getByLabel("Palavras-chave").fill("teste")
    await page.getByLabel("Curso").selectOption(academic.courseId)
    await page.getByLabel("Orientador").selectOption(academic.advisorId)
    await page.getByRole("button", { name: "Salvar rascunho" }).click()
    await expect(page.getByRole("status").filter({ hasText: "Dados da monografia salvos." })).toBeVisible()
  })

  test("salva metadados, envia o PDF e submete a monografia", async ({ page, request }) => {
    const academic = await seedAcademicContext(request)
    const title = `Monografia E2E ${Date.now()}`
    await loginAs(page, "Aluno E2E Envio", uniqueEmail("student-flow"), ["STUDENT"])
    await navigateTo(page, "Minha monografia")
    // Aguarda o carregamento do contexto (cursos/orientadores) antes de preencher.
    await expect.poll(async () => page.getByLabel("Curso").locator("option").count()).toBeGreaterThan(1)

    await page.getByLabel("Título da monografia").fill(title)
    await page.getByLabel("Curso").selectOption(academic.courseId)
    await page.getByLabel("Orientador").selectOption(academic.advisorId)
    await page.getByLabel("Palavras-chave").fill("teste, e2e")
    await page.getByLabel("Resumo").fill("Resumo criado pelo teste end-to-end.")
    await page.getByRole("button", { name: "Salvar rascunho" }).click()

    await expect(page.getByRole("status").filter({ hasText: "Dados da monografia salvos." })).toBeVisible()

    await page.getByRole("button", { name: "Continuar" }).click()
    await expect(page.getByText("Arraste o PDF da monografia até aqui")).toBeVisible()

    await page.locator('input[type="file"][accept="application/pdf,.pdf"]').setInputFiles("e2e/fixtures/minimal.pdf")
    await page.getByRole("button", { name: "Enviar e continuar" }).click()
    await expect(page.getByRole("status").filter({ hasText: "enviada e verificada" })).toBeVisible({ timeout: 15000 })

    await page.getByRole("button", { name: "Enviar para o orientador" }).click()
    await expect(page.getByRole("status").filter({ hasText: "Monografia enviada ao orientador" })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(title)).toBeVisible()
  })
})
