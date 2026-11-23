import { expect, test } from "@playwright/test"
import { seedPublishedThesis } from "./helpers/seed"

test.describe("Repositório público", () => {
  test("encontra no repositório um TCC publicado no backend e abre o detalhe com o SHA-256", async ({ page, request }) => {
    const title = `TCC publicado E2E ${Date.now()}`
    await seedPublishedThesis(request, title)

    await page.goto("/")
    await page.getByRole("button", { name: "Ir para o repositório público" }).click()
    await page.getByRole("textbox", { name: "Buscar no repositório" }).fill(title)
    await page.getByRole("button", { name: "Pesquisar" }).click()

    await expect(page.getByRole("heading", { name: "1 monografia encontrada" })).toBeVisible()
    await expect(page.getByRole("heading", { name: title })).toBeVisible()
    await page.getByRole("button", { name: "Ver detalhes" }).click()

    const dialog = page.getByRole("dialog", { name: title })
    await expect(dialog.getByText("Resumo do trabalho de teste end-to-end.")).toBeVisible()
    await expect(dialog.getByLabel("Hash SHA-256 do PDF publicado")).toHaveText(/^[0-9a-f]{64}$/)
    await expect(dialog.getByText(/@/)).toHaveCount(0)
  })
})
