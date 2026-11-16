import { afterAll, afterEach, beforeEach, expect, jest, test } from "@jest/globals"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ApiError, usersApi, type UserSuggestion } from "../../api/client"
import InstitutionalMemberModal from "./InstitutionalMemberModal"

const suggest = jest.spyOn(usersApi, "suggest")

beforeEach(() => {
  suggest.mockReset()
})

afterEach(cleanup)

afterAll(() => {
  jest.restoreAllMocks()
})

const SUGGESTIONS: UserSuggestion[] = [
  { id: "user-1", name: "Ana Souza", email: "ana@ufvjm.edu.br", avatarUrl: "https://lh3.googleusercontent.com/ana" },
  { id: "user-2", name: "André Lima", email: "andre@ufvjm.edu.br", avatarUrl: null },
]

test("shows top matches as you type and fills the email on selection", async () => {
  const onSubmit = jest.fn(async () => undefined)
  suggest.mockResolvedValue({ results: SUGGESTIONS })
  render(<InstitutionalMemberModal onClose={() => undefined} onSubmit={onSubmit} />)

  userEvent.type(screen.getByPlaceholderText(/nome\.sobrenome/), "a")
  userEvent.type(screen.getByPlaceholderText(/nome\.sobrenome/), "n")
  expect(await screen.findByRole("option", { name: /Ana Souza/ })).toBeTruthy()

  userEvent.click(screen.getByRole("option", { name: /^Ana Souza/ }))
  expect((screen.getByRole("combobox", { name: "Usuário ou e-mail institucional" }) as HTMLInputElement).value).toBe("ana@ufvjm.edu.br")
  expect(screen.getByRole("button", { name: "Adicionar membro" }).hasAttribute("disabled")).toBe(false)

  userEvent.click(screen.getByRole("button", { name: "Adicionar membro" }))
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", name: "Ana Souza" }))
})

test("keyboard navigation works with arrows and Enter accepts the highlighted row", async () => {
  suggest.mockResolvedValue({ results: SUGGESTIONS })
  render(<InstitutionalMemberModal onClose={() => undefined} onSubmit={jest.fn(async () => undefined)} />)

  const input = screen.getByRole("combobox", { name: "Usuário ou e-mail institucional" })
  userEvent.type(input, "ana")
  expect(await screen.findByRole("option", { name: /Ana Souza/ })).toBeTruthy()
  userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}")

  expect((input as HTMLInputElement).value).toBe("andre@ufvjm.edu.br")
  expect(screen.getByText("Usuário encontrado: André Lima.")).toBeTruthy()
})

test("escape closes the suggestion list without erasing the query", async () => {
  suggest.mockResolvedValue({ results: SUGGESTIONS })
  render(<InstitutionalMemberModal onClose={() => undefined} onSubmit={jest.fn(async () => undefined)} />)

  const input = screen.getByRole("combobox", { name: "Usuário ou e-mail institucional" })
  userEvent.type(input, "ana")
  expect(await screen.findByRole("option", { name: /Ana Souza/ })).toBeTruthy()
  userEvent.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull())
  expect((input as HTMLInputElement).value).toBe("ana")
})

test("shows the 403 message from the search endpoint instead of a separate button", async () => {
  suggest.mockRejectedValue(new ApiError("Apenas administradores.", 403))
  render(<InstitutionalMemberModal onClose={() => undefined} onSubmit={jest.fn(async () => undefined)} />)

  userEvent.type(screen.getByRole("combobox", { name: "Usuário ou e-mail institucional" }), "ana")
  expect(await screen.findByText("Busca de usuários disponível apenas para administradores, coordenadores e orientadores na rede institucional.")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Adicionar membro" }).hasAttribute("disabled")).toBe(true)
})

test("shows the not-found message when nothing matches", async () => {
  suggest.mockResolvedValue({ results: [] })
  render(<InstitutionalMemberModal onClose={() => undefined} onSubmit={jest.fn(async () => undefined)} />)

  userEvent.type(screen.getByRole("combobox", { name: "Usuário ou e-mail institucional" }), "zzzzzz")
  expect(await screen.findByText("Nenhum usuário correspondente.")).toBeTruthy()
})
