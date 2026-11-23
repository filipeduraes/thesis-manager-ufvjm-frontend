import { expect, test } from "@playwright/test"
import { loginAs, navigateTo } from "./helpers/auth"
import { seedApprovedThesis } from "./helpers/seed"

test.describe("Parecer do orientador", () => {
  test("aprova uma monografia submetida para banca", async ({ page, request }) => {
    const thesis = await seedApprovedThesis(request, `TCC para parecer E2E ${Date.now()}`)
    await loginAs(page, "Orientador E2E Parecer", thesis.advisorEmail, ["ADVISOR"])
    await navigateTo(page, "Orientandos")

    await expect(page.getByRole("heading", { name: "Acompanhamento e aprovação" })).toBeVisible()
    await page.getByPlaceholder("Buscar aluno, título ou referência...").fill(thesis.title)
    await page.getByRole("button", { name: "Filtrar" }).click()
    // O resumo da busca repete o termo; a linha é conferida pelo título exato.
    await expect(page.getByText(`1 monografia(s) encontrada(s) para “${thesis.title}”`)).toBeVisible()
    await expect(page.getByText(thesis.title, { exact: true })).toBeVisible()

    await page.getByRole("button", { name: new RegExp(thesis.title) }).first().click()
    await expect(page.getByText("Parecer do orientador")).toBeVisible()

    await page.getByPlaceholder("Registre pontos fortes, ajustes e orientações para a próxima etapa...").fill("Trabalho aprovado nos testes E2E.")
    await page.getByRole("button", { name: "Aprovar para banca" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar aprovação" }).click()

    await expect(page.getByRole("status").filter({ hasText: "Parecer de aprovação registrado." })).toBeVisible()
    await expect(page.getByText("Aprovada pelo orientador").first()).toBeVisible()
  })

  test("solicita ajustes em uma monografia submetida", async ({ page, request }) => {
    const thesis = await seedApprovedThesis(request, `TCC ajustes E2E ${Date.now()}`)
    await loginAs(page, "Orientador E2E Ajustes", thesis.advisorEmail, ["ADVISOR"])
    await navigateTo(page, "Orientandos")

    await page.getByPlaceholder("Buscar aluno, título ou referência...").fill(thesis.title)
    await page.getByRole("button", { name: "Filtrar" }).click()
    await page.getByRole("button", { name: new RegExp(thesis.title) }).first().click()

    await page.getByPlaceholder("Registre pontos fortes, ajustes e orientações para a próxima etapa...").fill("Ajustes necessários nos testes E2E.")
    await page.getByRole("button", { name: "Solicitar ajustes" }).click()
    await expect(page.getByRole("status").filter({ hasText: "Ajustes solicitados ao aluno." })).toBeVisible()
    await expect(page.getByText("Ajustes solicitados").first()).toBeVisible()
  })
})
