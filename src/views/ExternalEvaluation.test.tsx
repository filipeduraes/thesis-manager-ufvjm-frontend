import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { defenseApi, type DefenseCommitteeMember, type DefenseData, type SessionPayload } from "../api/client"
import ExternalEvaluation from "./ExternalEvaluation"

const getDefense = jest.spyOn(defenseApi, "get")
const respondAvailability = jest.spyOn(defenseApi, "respondAvailability")

const STATUS_LABELS: Record<string, string> = { SCHEDULED: "Agendada", IN_PROGRESS: "Em andamento", COMPLETED: "Concluída" }

function externalMember(): DefenseCommitteeMember {
  return {
    id: "member-ext",
    role: "MEMBER",
    roleLabel: "Membro",
    name: "Paula Externa",
    // E-mail diferente do convite: o membro deve ser localizado pelo memberId da sessão.
    email: "paula.antigo@externo.org",
    institution: "UFMG",
    hasConflict: false,
    conflictReason: "",
    isInstitutional: false,
    availabilityStatus: "PENDING",
    availabilityStatusLabel: "Pendente",
    availabilityRespondedAt: null,
    availabilityNote: "",
    createdAt: "2026-11-01T12:00:00Z",
    evaluation: null,
  }
}

function buildDefense(id: string, status: string, scheduledDatetime = "2026-11-20T17:00:00Z"): DefenseData {
  return {
    id,
    thesis: "thesis-1",
    scheduledDatetime,
    durationMinutes: 90,
    modality: "REMOTE",
    modalityLabel: "Remota",
    location: "https://meet.example.org/banca",
    notes: "",
    status,
    statusLabel: STATUS_LABELS[status] ?? status,
    createdAt: "2026-11-01T12:00:00Z",
    updatedAt: "2026-11-01T12:00:00Z",
    members: [externalMember()],
  }
}

type ExternalSession = NonNullable<SessionPayload["externalInvitation"]>

function session(assignments: ExternalSession["assignments"]): ExternalSession {
  return {
    id: "invitation-1",
    name: "Paula Externa",
    email: "paula@externo.org",
    institution: "UFMG",
    expiresAt: "2026-12-15T15:00:00Z",
    assignments,
  }
}

beforeEach(() => {
  getDefense.mockReset()
  respondAvailability.mockReset()
})

afterAll(() => {
  jest.restoreAllMocks()
})

test("opens the only assigned defense directly and lets the member confirm availability", async () => {
  getDefense.mockResolvedValue({ defense: buildDefense("defense-1", "SCHEDULED") })
  respondAvailability.mockResolvedValue({ member: { ...externalMember(), availabilityStatus: "CONFIRMED" } })
  render(<ExternalEvaluation goLogin={() => undefined} externalSession={session([{ defenseId: "defense-1", memberId: "member-ext" }])} />)

  expect(await screen.findByText("Dados da banca")).toBeTruthy()
  expect(getDefense).toHaveBeenCalledWith("defense-1")
  expect(screen.getByText("14:00 às 15:30")).toBeTruthy()
  expect(screen.getAllByText("https://meet.example.org/banca")).toHaveLength(2)
  expect(screen.getByText("Avaliação disponível quando a banca estiver em andamento")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Registrar avaliação" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Voltar" })).toBeNull()

  userEvent.click(screen.getByRole("button", { name: "Confirmar disponibilidade" }))
  await waitFor(() => expect(respondAvailability).toHaveBeenCalledWith("defense-1", "member-ext", { status: "CONFIRMED" }))
  await waitFor(() => expect(getDefense).toHaveBeenCalledTimes(2))
})

test("enables the evaluation form only while the defense is in progress", async () => {
  getDefense.mockResolvedValue({ defense: buildDefense("defense-1", "IN_PROGRESS") })
  render(<ExternalEvaluation goLogin={() => undefined} externalSession={session([{ defenseId: "defense-1", memberId: "member-ext" }])} />)

  expect(await screen.findByRole("button", { name: "Registrar avaliação" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Confirmar disponibilidade" })).toBeNull()
  expect(screen.getByRole("radio", { name: /Aprovada com ressalvas/ })).toHaveProperty("disabled", false)
})

test("lists several assigned defenses and opens the chosen one", async () => {
  getDefense.mockImplementation((defenseId: string) =>
    Promise.resolve({
      defense:
        defenseId === "defense-1"
          ? buildDefense("defense-1", "SCHEDULED")
          : buildDefense("defense-2", "IN_PROGRESS", "2026-11-21T12:00:00Z"),
    }),
  )
  render(
    <ExternalEvaluation
      goLogin={() => undefined}
      externalSession={session([
        { defenseId: "defense-1", memberId: "member-ext" },
        { defenseId: "defense-2", memberId: "member-ext-2" },
      ])}
    />,
  )

  expect(await screen.findByRole("heading", { name: "Escolha a banca" })).toBeTruthy()
  const second = await screen.findByRole("button", { name: /21 de nov\.? de 2026 · 09:00 às 10:30/ })
  expect(screen.getByRole("button", { name: /20 de nov\.? de 2026 · 14:00 às 15:30/ })).toBeTruthy()

  getDefense.mockResolvedValue({
    defense: { ...buildDefense("defense-2", "IN_PROGRESS"), members: [{ ...externalMember(), id: "member-ext-2" }] },
  })
  userEvent.click(second)
  expect(await screen.findByRole("button", { name: "Registrar avaliação" })).toBeTruthy()
  expect(getDefense).toHaveBeenLastCalledWith("defense-2")

  userEvent.click(screen.getByRole("button", { name: "Cancelar" }))
  expect(await screen.findByRole("heading", { name: "Escolha a banca" })).toBeTruthy()
})

test("explains when the invitation has no defense", () => {
  render(<ExternalEvaluation goLogin={() => undefined} externalSession={session([])} />)
  expect(screen.getByRole("heading", { name: "Nenhuma banca vinculada" })).toBeTruthy()
  expect(getDefense).not.toHaveBeenCalled()
})
