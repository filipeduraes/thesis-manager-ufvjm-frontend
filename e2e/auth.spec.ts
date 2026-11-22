import { expect, test } from "@playwright/test"
import { loginAs, logout, navigateTo, uniqueEmail } from "./helpers/auth"

test.describe("Autenticação e navegação", () => {
  test("login de administrador habilita o menu administrativo e logout retorna ao login", async ({ page }) => {
    await loginAs(page, "Admin E2E", uniqueEmail("admin"), ["ADMIN"])

    const menu = page.getByRole("navigation", { name: "Menu principal" })
    await expect(menu.getByRole("button", { name: "Usuários" })).toBeVisible()
    await expect(menu.getByRole("button", { name: "Cursos" })).toBeVisible()
    await expect(menu.getByRole("button", { name: "Auditoria" })).toBeVisible()

    await logout(page)
  })

  test("estudante não recebe o menu administrativo", async ({ page }) => {
    await loginAs(page, "Aluno E2E", uniqueEmail("student"), ["STUDENT"])

    const menu = page.getByRole("navigation", { name: "Menu principal" })
    await expect(menu.getByRole("button", { name: "Minha monografia" })).toBeVisible()
    await expect(menu.getByRole("button", { name: "Usuários" })).toHaveCount(0)
    await expect(menu.getByRole("button", { name: "Cursos" })).toHaveCount(0)
    await expect(menu.getByRole("button", { name: "Auditoria" })).toHaveCount(0)
  })

  // Este teste cobre apenas a tela estática/mock: o repositório público real
  // ainda não está implementado (ver public-repository.spec.ts).
  test("tela do repositório público (mock) é acessível sem autenticação", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "Ir para o repositório público" }).click()

    await expect(page).toHaveTitle(/Repositório de Monografias/)
    await expect(page.getByPlaceholder("Busque por título, autor, orientador ou palavra-chave")).toBeVisible()
  })

  test("token externo inválido apresenta mensagem de erro", async ({ page }) => {
    await page.goto("/")
    await page.getByLabel("Token de acesso da banca").fill("AAAA-BBBB-CCCC-DDDD")
    await page.getByRole("button", { name: "Acessar com token" }).click()

    await expect(page.getByRole("alert")).toBeVisible()
  })

  test("navegação para relatórios funciona para coordenador", async ({ page }) => {
    await loginAs(page, "Coord E2E", uniqueEmail("coord"), ["COORDINATOR"])
    await navigateTo(page, "Relatórios")
    await expect(page.getByRole("heading", { name: "Relatórios e indicadores" })).toBeVisible()
  })
})
