import { expect, type Page } from "@playwright/test"

type RoleCode = "ADMIN" | "COORDINATOR" | "ADVISOR" | "STUDENT"

const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: "Administrador",
  COORDINATOR: "Coordenador",
  ADVISOR: "Orientador",
  STUDENT: "Aluno",
}

let sequence = 0

/** Gera um e-mail único para isolar os usuários criados por cada teste. */
export function uniqueEmail(prefix: string): string {
  sequence += 1
  return `e2e-${prefix}-${Date.now()}-${sequence}@ufvjm.edu.br`
}

/**
 * Autentica pela interface usando o login de teste disponível em builds de
 * desenvolvimento. Navega até a tela de login e preenche o formulário real.
 */
export async function loginAs(page: Page, name: string, email: string, roles: RoleCode[]): Promise<void> {
  await page.goto("/")
  await page.evaluate(() => sessionStorage.clear())
  await page.getByRole("button", { name: "Entrar com usuário de teste" }).click()
  await page.getByPlaceholder("Nome do usuário de teste").fill(name)
  await page.getByPlaceholder("usuario@exemplo.local").fill(email)

  const listboxTrigger = page.getByRole("button", { name: "Papéis do usuário de teste" })
  await listboxTrigger.click()
  const listbox = page.getByRole("listbox")
  // "Aluno" vem selecionado por padrão e é exclusivo: desmarque antes de
  // selecionar qualquer outro papel.
  await listbox.getByText("Aluno").click()
  for (const role of roles) {
    await listbox.getByText(ROLE_LABELS[role]).click()
  }
  await page.keyboard.press("Escape")

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.getByRole("button", { name: "Entrar como usuário de teste" }).click()
    try {
      await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible({ timeout: 8000 })
      return
    } catch (error) {
      if (attempt === 1) throw error
      const alert = page.getByRole("alert")
      if (await alert.isVisible()) await alert.getByRole("button", { name: "Fechar erro" }).click().catch(() => undefined)
    }
  }
}

/** Encerra a sessão pela interface e confirma o retorno ao login. */
export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Sair" }).click()
  await expect(page.getByRole("heading", { name: "Login institucional" })).toBeVisible()
}

/** Clica em um item do menu principal. */
export async function navigateTo(page: Page, label: string): Promise<void> {
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("button", { name: label }).click()
}
