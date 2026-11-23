import { expect, test } from "@playwright/test"
import { loginAs, navigateTo, uniqueEmail } from "./helpers/auth"

test.describe("Gestão de cursos (administrador)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "Admin Cursos E2E", uniqueEmail("admin-courses"), ["ADMIN"])
    await navigateTo(page, "Cursos")
    await expect(page.getByRole("heading", { name: "Gestão de cursos" })).toBeVisible()
  })

  test("cria, edita e exclui um curso", async ({ page }) => {
    const suffix = Date.now().toString().slice(-6)
    const name = `Curso E2E ${suffix}`
    const code = `CE${suffix}`
    const newName = `${name} atualizado`

    await page.getByRole("button", { name: "Adicionar curso" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("Ex.: Engenharia de Sistemas").fill(name)
    await dialog.getByPlaceholder("Ex.: ESI").fill(code)
    await dialog.getByLabel("Departamento").selectOption("__new__")
    await dialog.getByPlaceholder("Nome do departamento").fill(`Departamento E2E ${suffix}`)
    await dialog.getByRole("button", { name: "Criar curso" }).click()

    await expect(page.getByRole("status").filter({ hasText: "Curso criado com sucesso." })).toBeVisible()
    await page.getByPlaceholder("Buscar curso ou código").fill(code)
    await expect(page.getByRole("heading", { name })).toBeVisible()

    await page.getByRole("button", { name: `Ações de ${name}` }).click()
    await page.locator(".action-menu").getByRole("button", { name: "Editar curso" }).click()
    const editDialog = page.getByRole("dialog")
    await editDialog.getByPlaceholder("Ex.: Engenharia de Sistemas").fill(newName)
    await editDialog.getByRole("button", { name: "Salvar alterações" }).click()

    await expect(page.getByRole("status").filter({ hasText: "Curso atualizado com sucesso." })).toBeVisible()
    await page.getByPlaceholder("Buscar curso ou código").fill(newName)
    await expect(page.getByRole("heading", { name: newName })).toBeVisible()

    await page.getByRole("button", { name: `Ações de ${newName}` }).click()
    await page.getByRole("button", { name: "Excluir curso" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Excluir curso" }).click()

    await expect(page.getByRole("status").filter({ hasText: "Curso excluído com sucesso." })).toBeVisible()
    await expect(page.getByRole("heading", { name: newName })).toHaveCount(0)
  })

  test("busca um curso inexistente e exibe o estado vazio", async ({ page }) => {
    await page.getByPlaceholder("Buscar curso ou código").fill("CURSO-QUE-NAO-EXISTE-123456")
    await expect(page.getByText("Nenhum curso encontrado.")).toBeVisible()
  })
})
