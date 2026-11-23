import { expect, test } from "@playwright/test"
import { loginAs } from "./helpers/auth"
import { seedInProgressDefense } from "./helpers/seed"

test.describe("Avaliação de membro da banca", () => {
  test("registra nota e parecer pela interface e a banca é apurada", async ({ page, request }) => {
    const seeded = await seedInProgressDefense(request, `TCC avaliação E2E ${Date.now()}`)

    await loginAs(page, "Avaliador E2E", seeded.evaluatorEmail, ["ADVISOR"])
    await page.getByRole("button", { name: "Avaliar" }).first().click()

    await page.getByRole("radio", { name: /Aprovada com ressalvas/ }).check()
    await page.getByPlaceholder("Ex.: 8.50").fill("7.50")
    await page.getByPlaceholder("Comentários para o aluno e para a comissão").fill("Parecer registrado pela interface E2E.")
    await page.getByRole("button", { name: "Registrar avaliação" }).click()

    await expect(page.getByText("Avaliação enviada")).toBeVisible({ timeout: 15000 })
  })
})
