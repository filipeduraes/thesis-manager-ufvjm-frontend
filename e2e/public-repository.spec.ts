import { expect, test } from "@playwright/test"
import { seedPublishedThesis } from "./helpers/seed"

test.describe("Repositório público", () => {
  test.fixme("O repositório público ainda usa dados mockados (src/data/mockData.ts) e não consulta GET /api/v1/public/theses.")
  test("encontra no repositório um TCC publicado no backend", async ({ page, request }) => {
    const title = `TCC publicado E2E ${Date.now()}`
    await seedPublishedThesis(request, title)

    await page.goto("/")
    await page.getByRole("button", { name: "Ir para o repositório público" }).click()
    await page.getByPlaceholder("Busque por título, autor, orientador ou palavra-chave").fill(title)
    await page.getByRole("button", { name: "Pesquisar" }).click()

    await expect(page.getByText(title)).toBeVisible()
  })
})
