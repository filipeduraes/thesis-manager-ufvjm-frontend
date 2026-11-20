import { afterEach, expect, jest, test } from "@jest/globals"
import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ApiError } from "../api/client"
import LoginView from "./LoginView"

function renderLogin(exchangeToken: (token: string) => Promise<void>) {
  render(
    <LoginView
      go={() => undefined}
      loginGoogle={() => Promise.resolve()}
      exchangeToken={exchangeToken}
      loading={false}
      error=""
    />,
  )
  return screen.getByLabelText("Token de acesso da banca") as HTMLInputElement
}

afterEach(() => {
  jest.useRealTimers()
})

test("formats the typed token in groups and sends it with the UFVJM prefix on Enter", async () => {
  const exchangeToken = jest.fn((_token: string) => Promise.resolve())
  const input = renderLogin(exchangeToken)

  userEvent.type(input, "abcdefghjklmnpqr{enter}")

  expect(input.value).toBe("ABCD-EFGH-JKLM-NPQR")
  expect(exchangeToken).toHaveBeenCalledWith("UFVJM-ABCD-EFGH-JKLM-NPQR")
})

test("accepts the whole token pasted with the prefix", () => {
  const exchangeToken = jest.fn((_token: string) => Promise.resolve())
  const input = renderLogin(exchangeToken)

  fireEvent.paste(input, { clipboardData: { getData: () => "ufvjm-abcd-efgh-jklm-npqr" } })

  expect(input.value).toBe("ABCD-EFGH-JKLM-NPQR")
})

test("does not call the API with an incomplete token and explains what is missing", () => {
  const exchangeToken = jest.fn((_token: string) => Promise.resolve())
  const input = renderLogin(exchangeToken)

  userEvent.type(input, "ABCD-EF")
  userEvent.click(screen.getByRole("button", { name: "Acessar com token" }))

  expect(exchangeToken).not.toHaveBeenCalled()
  expect(screen.getByRole("alert").textContent).toMatch(/token completo/)
  expect(input.getAttribute("aria-invalid")).toBe("true")
})

test("shows the backend message for an invalid token and keeps the field for correction", async () => {
  const exchangeToken = jest.fn((_token: string) => Promise.reject(new ApiError("Token inválido ou expirado.", 400)))
  const input = renderLogin(exchangeToken)

  userEvent.type(input, "ABCDEFGHJKLMNPQR")
  userEvent.click(screen.getByRole("button", { name: "Acessar com token" }))

  expect((await screen.findByRole("alert")).textContent).toMatch(/Token inválido ou expirado\./)
  expect(input.value).toBe("ABCD-EFGH-JKLM-NPQR")
})

test("pauses new attempts after rate limiting (429)", async () => {
  jest.useFakeTimers()
  const exchangeToken = jest.fn((_token: string) => Promise.reject(new ApiError("Throttled", 429)))
  const input = renderLogin(exchangeToken)

  fireEvent.change(input, { target: { value: "ABCDEFGHJKLMNPQR" } })
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Acessar com token" }))
  })

  expect(screen.getByRole("alert").textContent).toMatch(/Muitas tentativas/)
  const waiting = screen.getByRole("button", { name: /Aguarde \d+s/ }) as HTMLButtonElement
  expect(waiting.disabled).toBe(true)

  // O contador é reagendado a cada segundo, então cada passo precisa de um render entre eles.
  for (let second = 0; second < 15; second += 1) {
    act(() => {
      jest.advanceTimersByTime(1000)
    })
  }
  expect((screen.getByRole("button", { name: "Acessar com token" }) as HTMLButtonElement).disabled).toBe(false)
})
