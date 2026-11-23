import { expect, jest, test } from "@jest/globals"
import { fireEvent, render, screen } from "@testing-library/react"
import CoauthorPicker from "./CoauthorPicker"
import type { UserSuggestion } from "../../api/client"

const existing: UserSuggestion[] = [
  { id: "1", name: "Ana Aluna", email: "ana@ufvjm.edu.br", avatarUrl: null },
  { id: "2", name: "Bruno Aluno", email: "bruno@ufvjm.edu.br", avatarUrl: null },
]

test("shows the selected coauthors and removes one", () => {
  const onChange = jest.fn<void, [UserSuggestion[]]>()
  render(<CoauthorPicker value={existing} onChange={onChange} maxAuthors={5} />)
  expect(screen.getByText("Ana Aluna")).toBeTruthy()
  expect(screen.getByText(/2\/4 coautores selecionados/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Remover Bruno Aluno" }))
  expect(onChange).toHaveBeenCalledWith([existing[0]])
})

test("hides the search field when the group is full", () => {
  const value: UserSuggestion[] = [
    ...existing,
    { id: "3", name: "Carla", email: "carla@ufvjm.edu.br", avatarUrl: null },
    { id: "4", name: "Diego", email: "diego@ufvjm.edu.br", avatarUrl: null },
  ]
  render(<CoauthorPicker value={value} onChange={jest.fn<void, [UserSuggestion[]]>()} maxAuthors={5} />)
  expect(screen.queryByPlaceholderText("Nome ou e-mail do colega")).toBeNull()
  expect(screen.getByText(/4\/4 coautores selecionados/)).toBeTruthy()
})
