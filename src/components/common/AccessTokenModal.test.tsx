import { afterEach, expect, jest, test } from "@jest/globals"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AccessTokenModal from "./AccessTokenModal"

const TOKEN = { memberId: "m-1", memberName: "Paula Externa", token: "UFVJM-AAAA-BBBB-CCCC-DDDD", expiresAt: "2026-12-15T15:00:00Z" }

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
}

afterEach(() => {
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true })
})

test("shows the token once with the warning and copies it", async () => {
  const writeText = jest.fn((_text: string) => Promise.resolve())
  mockClipboard(writeText)
  const onClose = jest.fn()
  render(<AccessTokenModal tokens={[TOKEN]} onClose={onClose} />)

  expect(screen.getByRole("dialog", { name: "Token de acesso" })).toBeTruthy()
  expect(screen.getByText("Guarde este token: ele não será exibido novamente.")).toBeTruthy()
  expect(screen.getByText("UFVJM-AAAA-BBBB-CCCC-DDDD")).toBeTruthy()
  expect(screen.getByText(/Paula Externa/)).toBeTruthy()

  userEvent.click(screen.getByRole("button", { name: "Copiar" }))
  expect(await screen.findByRole("button", { name: "Copiado" })).toBeTruthy()
  expect(writeText).toHaveBeenCalledWith("UFVJM-AAAA-BBBB-CCCC-DDDD")
  expect(screen.getByText("Token copiado para a área de transferência.")).toBeTruthy()

  userEvent.click(screen.getByRole("button", { name: "Concluir" }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

test("asks to copy manually when the clipboard is not available", async () => {
  mockClipboard(() => Promise.reject(new Error("denied")))
  render(<AccessTokenModal tokens={[TOKEN]} onClose={() => undefined} />)
  userEvent.click(screen.getByRole("button", { name: "Copiar" }))
  expect(await screen.findByText("Não foi possível copiar. Selecione o token e copie manualmente.")).toBeTruthy()
})
