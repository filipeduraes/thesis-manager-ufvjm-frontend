import { expect, test } from "@playwright/test"
import { loginAs, navigateTo, uniqueEmail } from "./helpers/auth"
import { seedApprovedThesis } from "./helpers/seed"

test.describe("Relatórios", () => {
  test("carrega indicadores e exporta o PDF", async ({ page, request }) => {
    const thesis = await seedApprovedThesis(request, `TCC relatório E2E ${Date.now()}`)
    await loginAs(page, "Coord Relatórios E2E", thesis.coordinatorEmail, ["COORDINATOR"])
    await navigateTo(page, "Relatórios")

    await expect(page.getByRole("heading", { name: "Relatórios e indicadores" })).toBeVisible()
    await expect(page.getByText("Total de monografias")).toBeVisible()
    await expect(page.getByRole("heading", { name: "Taxa de aprovação em bancas" })).toBeVisible()
    await expect(page.getByText("Indicadores por curso")).toBeVisible()

    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: "Exportar PDF" }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^relatorio-tcc-\d{8}-\d{4}\.pdf$/)
  })

  test("administrador visualiza os relatórios sem dados", async ({ page }) => {
    await loginAs(page, "Admin Relatórios E2E", uniqueEmail("admin-reports"), ["ADMIN"])
    await navigateTo(page, "Relatórios")
    await expect(page.getByRole("heading", { name: "Relatórios e indicadores" })).toBeVisible()
    await expect(page.getByText("Dados de todos os cursos.")).toBeVisible()
  })
})
