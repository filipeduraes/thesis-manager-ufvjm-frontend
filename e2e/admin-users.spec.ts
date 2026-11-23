import { expect, test } from "@playwright/test"
import { loginAs, navigateTo, uniqueEmail } from "./helpers/auth"

test.describe("Gestão de usuários (administrador)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "Admin Usuários E2E", uniqueEmail("admin-users"), ["ADMIN"])
    await navigateTo(page, "Usuários")
    await expect(page.getByRole("heading", { name: "Gestão de usuários" })).toBeVisible()
  })

  test("cria um usuário, altera seus perfis e o desativa", async ({ page }) => {
    const suffix = Date.now().toString().slice(-6)
    const name = `Usuário E2E ${suffix}`
    const email = uniqueEmail("managed")

    await page.getByRole("button", { name: "Adicionar usuário" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("Nome do usuário").fill(name)
    await dialog.getByPlaceholder("usuario@ufvjm.edu.br").fill(email)

    const rolesTrigger = dialog.getByRole("button", { name: "Perfis de acesso" })
    await rolesTrigger.click()
    const listbox = dialog.getByRole("listbox")
    await listbox.getByText("Aluno").click()
    await listbox.getByText("Orientador").click()
    await page.keyboard.press("Escape")
    await dialog.getByRole("button", { name: "Criar usuário" }).click()

    await expect(page.getByRole("status").filter({ hasText: "Usuário criado com sucesso." })).toBeVisible()
    await page.getByPlaceholder("Buscar por nome ou e-mail").fill(email)
    await expect(page.getByText(name)).toBeVisible()

    await page.getByRole("button", { name: `Ações de ${name}` }).click()
    await page.getByRole("button", { name: "Editar usuário" }).click()
    const editDialog = page.getByRole("dialog")
    await editDialog.getByRole("button", { name: "Perfis de acesso" }).click()
    await editDialog.getByRole("listbox").getByText("Coordenador").click()
    await page.keyboard.press("Escape")
    await editDialog.getByRole("button", { name: "Salvar alterações" }).click()

    await expect(page.getByRole("status").filter({ hasText: "Usuário atualizado com sucesso." })).toBeVisible()

    await page.getByRole("button", { name: `Ações de ${name}` }).click()
    await page.getByRole("button", { name: "Remover usuário" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Desativar usuário" }).click()

    await expect(page.getByRole("status").filter({ hasText: "Usuário desativado com sucesso." })).toBeVisible()
  })

  test("busca um usuário inexistente e exibe o estado vazio", async ({ page }) => {
    await page.getByPlaceholder("Buscar por nome ou e-mail").fill("inexistente-e2e-123456@ufvjm.edu.br")
    await expect(page.getByText("Nenhum usuário encontrado.")).toBeVisible()
  })
})
