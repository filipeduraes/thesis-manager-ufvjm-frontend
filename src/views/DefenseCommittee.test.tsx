import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { act, render, screen, waitFor } from "@testing-library/react"
import { defenseApi, thesesApi, type DefenseData, type Thesis } from "../api/client"
import DefenseCommittee from "./DefenseCommittee"

const getDefense = jest.spyOn(defenseApi, "get")
const getThesis = jest.spyOn(thesesApi, "detail")

function buildDefense(status: string): DefenseData {
  return {
    id: "defense-1",
    thesis: "thesis-1",
    scheduledDatetime: "2026-11-16T20:00:00Z",
    durationMinutes: 120,
    modality: "IN_PERSON",
    modalityLabel: "Presencial",
    location: "Auditório",
    notes: "",
    status,
    statusLabel: status === "SCHEDULED" ? "Agendada" : "Em andamento",
    createdAt: "2026-11-01T12:00:00Z",
    updatedAt: "2026-11-01T12:00:00Z",
    members: [],
  }
}

function thesisAdvisedBy(advisorId: string): { thesis: Thesis } {
  // Somente o campo usado pela tela importa para o teste.
  const partial: Pick<Thesis, "advisor"> = { advisor: { id: advisorId, name: "Orientador", email: "o@ufvjm.edu.br" } }
  return { thesis: partial as Thesis }
}

beforeEach(() => {
  getDefense.mockReset()
  getThesis.mockReset()
})

afterAll(() => {
  jest.restoreAllMocks()
})

test("coordinator sees edit and cancel actions and the defense details for a scheduled defense", async () => {
  getDefense.mockResolvedValue({ defense: buildDefense("SCHEDULED") })
  render(<DefenseCommittee defenseId="defense-1" goBack={() => undefined} canStartClose />)

  expect(await screen.findByRole("button", { name: "Editar agendamento" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Cancelar banca" })).toBeTruthy()
  expect(screen.getByText("17:00 às 19:00")).toBeTruthy()
  expect(screen.getByText("2h")).toBeTruthy()
})

test("hides edit and cancel actions once the defense has started", async () => {
  getDefense.mockResolvedValue({ defense: buildDefense("IN_PROGRESS") })
  render(<DefenseCommittee defenseId="defense-1" goBack={() => undefined} canStartClose />)

  expect(await screen.findByText("Dados da banca")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Editar agendamento" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Cancelar banca" })).toBeNull()
})

test("advisor manages only the defense of a thesis they advise", async () => {
  getDefense.mockResolvedValue({ defense: buildDefense("SCHEDULED") })
  getThesis.mockResolvedValue(thesisAdvisedBy("advisor-1"))
  render(<DefenseCommittee defenseId="defense-1" goBack={() => undefined} isAdvisor currentUserId="advisor-1" />)
  expect(await screen.findByRole("button", { name: "Editar agendamento" })).toBeTruthy()
})

test("advisor of another thesis does not see edit and cancel actions", async () => {
  getDefense.mockResolvedValue({ defense: buildDefense("SCHEDULED") })
  getThesis.mockResolvedValue(thesisAdvisedBy("someone-else"))
  render(<DefenseCommittee defenseId="defense-1" goBack={() => undefined} isAdvisor currentUserId="advisor-1" />)

  expect(await screen.findByText("Dados da banca")).toBeTruthy()
  await waitFor(() => expect(getThesis).toHaveBeenCalledWith("thesis-1"))
  // Deixa a promessa da verificação de orientador resolver antes de conferir.
  await act(async () => {
    await Promise.resolve()
  })
  expect(screen.queryByRole("button", { name: "Editar agendamento" })).toBeNull()
})
