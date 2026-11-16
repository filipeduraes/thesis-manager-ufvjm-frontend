import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { adminApi } from "../../api/client"
import InstitutionalMemberModal from "./InstitutionalMemberModal"

const lookupUser = jest.spyOn(adminApi, "lookupUser")

beforeEach(() => {
  lookupUser.mockReset()
})

afterAll(() => {
  jest.restoreAllMocks()
})

async function searchFor(avatarUrl: string | null, onSubmit = jest.fn(async () => undefined)) {
  lookupUser.mockResolvedValue({
    found: true,
    user: { id: "user-1", name: "Ana Souza", email: "ana@ufvjm.edu.br", isActive: true, avatarUrl },
    message: "Usuário encontrado: Ana Souza.",
  })
  render(<InstitutionalMemberModal onClose={() => undefined} onSubmit={onSubmit} />)
  userEvent.type(screen.getByPlaceholderText("professor@ufvjm.edu.br"), "ana@ufvjm.edu.br")
  userEvent.click(screen.getByRole("button", { name: "Buscar" }))
  await screen.findByText("Ana Souza")
}

test("shows the photo of the user found by the lookup and sends it with the draft", async () => {
  const onSubmit = jest.fn(async () => undefined)
  await searchFor("https://lh3.googleusercontent.com/ana", onSubmit)
  // Foto decorativa (alt vazio, avatar aria-hidden).
  const photo = screen.getByRole("presentation", { hidden: true })
  expect(photo.getAttribute("src")).toBe("https://lh3.googleusercontent.com/ana")

  userEvent.click(screen.getByRole("button", { name: "Adicionar membro" }))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ userId: "user-1", avatarUrl: "https://lh3.googleusercontent.com/ana" }),
  )
})

test("shows the initials when the user found has no photo", async () => {
  await searchFor(null)
  expect(screen.queryByRole("presentation", { hidden: true })).toBeNull()
  expect(screen.getByText("AS")).toBeTruthy()
})
