import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import App from "./App"
import {
  authApi,
  defenseApi,
  reportsApi,
  type DefenseData,
  type DefenseListItem,
  type SessionPayload,
  type ThesisListItem,
} from "./api/client"
import { buildReportsOverview } from "./views/dashboard/reportsOverviewFixture"
import { defensePermissions } from "./views/defense/defensePermissionsFixture"

const getSession = jest.spyOn(authApi, "getSession")
const listDefenses = jest.spyOn(defenseApi, "list")
const listSchedulable = jest.spyOn(defenseApi, "schedulableTheses")
const getDefense = jest.spyOn(defenseApi, "get")
const scheduleDefense = jest.spyOn(defenseApi, "schedule")
const updateDefense = jest.spyOn(defenseApi, "update")
const cancelDefense = jest.spyOn(defenseApi, "cancel")
// O coordenador abre na tela inicial, que consulta os relatórios.
const reportsOverview = jest.spyOn(reportsApi, "overview")

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
  viewerPermissions: defensePermissions("manager", "SCHEDULED"),
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
  viewerPermissions: defensePermissions("manager", "SCHEDULED"),
}

function page<T>(results: T[]) {
  return { count: results.length, page: 1, pageSize: 100, totalPages: 1, lastPageCount: results.length, results }
}

beforeEach(() => {
  window.sessionStorage.clear()
  jest.clearAllMocks()
  getSession.mockResolvedValue(COORDINATOR_SESSION)
  listDefenses.mockResolvedValue(page([LIST_ITEM]))
  listSchedulable.mockResolvedValue(page([]))
  getDefense.mockResolvedValue({ defense: DEFENSE })
  reportsOverview.mockResolvedValue(buildReportsOverview({ scope: "COORDINATED_COURSES" }))
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
  userEvent.click(await screen.findByRole("button", { name: "Gerenciar banca" }))

  expect(await screen.findByText("Dados da banca")).toBeTruthy()
  expect(screen.getAllByRole("heading", { name: "Gerenciar banca" }).length).toBeGreaterThan(0)
  await waitFor(() => expect(getDefense).toHaveBeenCalledWith("defense-1"))
  expect(screen.getByText("Dados da banca")).toBeTruthy()
  expect(screen.queryByRole("tab", { name: "Bancas 1" })).toBeNull()
})

// Data distante no futuro: o formulário recusa horários que já passaram.
const FUTURE_DEFENSE: DefenseData = { ...DEFENSE, scheduledDatetime: "2030-03-10T20:00:00+00:00" }

const SCHEDULABLE_THESIS: ThesisListItem = {
  id: "thesis-1",
  referenceCode: "TCC-TESTE",
  title: "Monografia de teste",
  status: "ADVISOR_APPROVED",
  statusLabel: "Aprovada pelo orientador",
  statusDescription: "",
  progressStep: 3,
  isPublic: false,
  course: { id: "course-1", name: "Sistemas de Informação", code: "SI" },
  advisor: { id: "advisor-1", name: "Orientador", email: "orientador@ufvjm.edu.br" },
  student: { id: "student-1", name: "Estudante", email: "estudante@ufvjm.edu.br" },
  keywords: [],
  currentVersion: 1,
  currentFile: null,
  submittedAt: null,
  updatedAt: "2026-11-01T12:00:00Z",
  advisorApprovedAt: "2026-11-01T12:00:00Z",
  pendingReview: false,
  permissions: {
    canEdit: false,
    canUpload: false,
    canSubmit: false,
    canWithdrawSubmission: false,
    canReview: false,
    canManage: true,
    canPublish: false,
    canRecordDefenseResult: false,
    canUploadDocuments: false,
  },
}

test("schedules, edits and cancels a defense, then returns to the list", async () => {
  const edited: DefenseData = { ...FUTURE_DEFENSE, scheduledDatetime: "2030-03-10T21:00:00+00:00" }
  const cancelled: DefenseData = {
    ...edited,
    status: "CANCELLED",
    statusLabel: "Cancelada",
    viewerPermissions: defensePermissions("manager", "CANCELLED"),
  }
  listSchedulable.mockResolvedValue(page([SCHEDULABLE_THESIS]))
  scheduleDefense.mockResolvedValue({ defense: FUTURE_DEFENSE })
  getDefense.mockResolvedValueOnce({ defense: FUTURE_DEFENSE })
  updateDefense.mockResolvedValue({ defense: edited })
  getDefense.mockResolvedValueOnce({ defense: edited })
  cancelDefense.mockResolvedValue({ defense: cancelled })
  getDefense.mockResolvedValue({ defense: cancelled })
  render(<App />)

  const navigation = await screen.findByRole("navigation")
  userEvent.click(within(navigation).getByRole("button", { name: "Bancas" }))

  userEvent.click(await screen.findByRole("button", { name: "Selecionar" }))
  userEvent.click(await screen.findByRole("button", { name: /Monografia de teste/ }))
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2030-03-10" } })
  fireEvent.change(screen.getByLabelText("Horário de início"), { target: { value: "17:00" } })
  userEvent.click(screen.getByRole("button", { name: "2h" }))
  userEvent.click(screen.getByRole("radio", { name: "Presencial" }))
  expect(screen.getByText("Término previsto: 19:00")).toBeTruthy()
  userEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }))

  await waitFor(() => expect(scheduleDefense).toHaveBeenCalledTimes(1))
  expect(scheduleDefense.mock.calls[0]?.[0]).toBe("thesis-1")
  expect(scheduleDefense.mock.calls[0]?.[1]).toMatchObject({
    scheduledDatetime: "2030-03-10T20:00:00.000Z",
    durationMinutes: 120,
    modality: "IN_PERSON",
  })

  userEvent.click(await screen.findByRole("button", { name: "Editar agendamento" }))
  expect(screen.getByLabelText("Horário de início")).toHaveProperty("value", "17:00")
  fireEvent.change(screen.getByLabelText("Horário de início"), { target: { value: "18:00" } })
  userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }))
  await waitFor(() =>
    expect(updateDefense).toHaveBeenCalledWith("defense-1", { scheduledDatetime: "2030-03-10T21:00:00.000Z" }),
  )
  expect(await screen.findByText("18:00 às 20:00")).toBeTruthy()

  userEvent.click(screen.getByRole("button", { name: "Cancelar banca" }))
  userEvent.type(screen.getByLabelText(/Motivo/), "Banca remarcada")
  userEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }))
  await waitFor(() => expect(cancelDefense).toHaveBeenCalledWith("defense-1", "Banca remarcada"))
  // "Cancelada" aparece no selo do topo e na etapa da linha do tempo.
  expect((await screen.findAllByText("Cancelada")).length).toBeGreaterThan(0)
  expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Cancelada")
  expect(screen.queryByRole("button", { name: "Editar agendamento" })).toBeNull()

  const breadcrumb = screen.getByRole("navigation", { name: "Caminho" })
  userEvent.click(within(breadcrumb).getByRole("button", { name: "Bancas" }))
  userEvent.click(await screen.findByRole("tab", { name: "Bancas 1" }))
  expect(await screen.findByText("Monografia de teste")).toBeTruthy()
})
