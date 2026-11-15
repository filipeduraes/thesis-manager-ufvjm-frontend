import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import App from "./App"
import { authApi, defenseApi, type DefenseData, type DefenseListItem, type SessionPayload } from "./api/client"

const getSession = jest.spyOn(authApi, "getSession")
const listDefenses = jest.spyOn(defenseApi, "list")
const listSchedulable = jest.spyOn(defenseApi, "schedulableTheses")
const getDefense = jest.spyOn(defenseApi, "get")

const COORDINATOR_SESSION: SessionPayload = {
  authenticated: true,
  authType: "institutional",
  csrfToken: "",
  externalInvitation: null,
  user: {
    id: "coordinator-1",
    name: "Coordenação Teste",
    email: "coordenacao@ufvjm.edu.br",
    affiliation: "",
    status: "Ativo",
    initials: "CT",
    avatarUrl: null,
    course: null,
    lastAccess: null,
    roleCode: "COORDINATOR",
    roleLabel: "Coordenador",
    roles: [{ code: "COORDINATOR", label: "Coordenador" }],
  },
}

const DEFENSE: DefenseData = {
  id: "defense-1",
  thesis: "thesis-1",
  scheduledDatetime: "2026-11-16T20:00:00Z",
  durationMinutes: 120,
  modality: "IN_PERSON",
  modalityLabel: "Presencial",
  location: "Auditório",
  notes: "",
  status: "SCHEDULED",
  statusLabel: "Agendada",
  createdAt: "2026-11-01T12:00:00Z",
  updatedAt: "2026-11-01T12:00:00Z",
  members: [],
}

const LIST_ITEM: DefenseListItem = {
  ...DEFENSE,
  thesisTitle: "Monografia de teste",
  thesisReferenceCode: "TCC-TESTE",
  student: null,
  advisor: null,
  viewerMembership: {
    isMember: false,
    memberId: null,
    role: null,
    roleLabel: null,
    canEvaluate: false,
    hasEvaluated: false,
  },
}

function page<T>(results: T[]) {
  return { count: results.length, page: 1, pageSize: 100, totalPages: 1, lastPageCount: results.length, results }
}

beforeEach(() => {
  getSession.mockResolvedValue(COORDINATOR_SESSION)
  listDefenses.mockResolvedValue(page([LIST_ITEM]))
  listSchedulable.mockResolvedValue(page([]))
  getDefense.mockResolvedValue({ defense: DEFENSE })
})

afterAll(() => {
  jest.restoreAllMocks()
})

test("opens the committee screen from the defense list without redirecting to the dashboard", async () => {
  render(<App />)

  const navigation = await screen.findByRole("navigation")
  userEvent.click(within(navigation).getByRole("button", { name: "Bancas" }))
  // A aba mostra o rótulo "Bancas" seguido do total real retornado pelo backend.
  userEvent.click(await screen.findByRole("tab", { name: "Bancas 1" }))
  expect(await screen.findByRole("heading", { name: "Bancas" })).toBeTruthy()
  userEvent.click(await screen.findByRole("button", { name: "Membros" }))

  expect(await screen.findByText("Dados da banca")).toBeTruthy()
  await waitFor(() => expect(getDefense).toHaveBeenCalledWith("defense-1"))
  expect(screen.getByText("Dados da banca")).toBeTruthy()
  expect(screen.queryByRole("tab", { name: "Bancas 1" })).toBeNull()
})
