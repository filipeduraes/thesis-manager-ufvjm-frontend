import { expect, test } from "@playwright/test"
import { loginAs, navigateTo, uniqueEmail } from "./helpers/auth"

test.describe("Auditoria do sistema (administrador)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "Admin Auditoria E2E", uniqueEmail("admin-audit"), ["ADMIN"])
    await navigateTo(page, "Auditoria")
    await expect(page.getByRole("heading", { name: "Auditoria do sistema" })).toBeVisible()
  })

  test("lista eventos, abre o detalhe e valida os dados exibidos", async ({ page }) => {
    const total = page.getByRole("status").filter({ hasText: "Total de registros:" })
    await expect(total).toBeVisible()

    const firstRow = page.locator(".audit-table .admin-row[role='button']").first()
    await expect(firstRow).toBeVisible()
    await firstRow.click()

    const modal = page.getByRole("dialog")
    await expect(modal.getByText("Detalhes da auditoria")).toBeVisible()
    await expect(modal.getByText("Entidade", { exact: true })).toBeVisible()
    await expect(modal.getByText("ID:")).toBeVisible()
    await modal.getByRole("button", { name: "Fechar" }).last().click()
    await expect(modal).toHaveCount(0)
  })

  test("filtra por categoria e aplica o filtro", async ({ page }) => {
    await page.getByRole("button", { name: "Categorias de auditoria" }).click()
    const listbox = page.getByRole("listbox")
    await listbox.getByText("Acesso").click()
    await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Aplicar filtros" }).click()

    // "Acesso" estava selecionado por padrão; desmarcá-lo deve remover os logs
    // de login/download da listagem, mas manter os demais.
    await expect(page.getByRole("button", { name: "Categorias de auditoria" })).not.toHaveText(/Acesso/)
    await expect(page.getByRole("status").filter({ hasText: "Total de registros:" })).toBeVisible()
    const rows = page.locator(".audit-table .admin-row[role='button']")
    await expect(rows.first()).toBeVisible()
    await expect(rows.filter({ hasText: "Acesso" })).toHaveCount(0)
  })

  test("exporta o log em CSV", async ({ page }) => {
    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: "Exportar log" }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe("audit-logs.csv")
  })

  test("exibe o estado vazio para uma busca sem resultados", async ({ page }) => {
    await page.locator("#audit-keyword").fill("termo-inexistente-e2e-987654")
    await page.getByRole("button", { name: "Aplicar filtros" }).click()
    await expect(page.getByText("Nenhum evento encontrado.")).toBeVisible()
  })
})
