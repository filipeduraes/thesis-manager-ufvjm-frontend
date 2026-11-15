import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  ApiError,
  defenseApi,
  thesesApi,
  type DefenseData,
  type DefenseStatusHistoryEntry,
  type Thesis,
} from "../api/client"
import DefenseCommittee from "./DefenseCommittee"

const getDefense = jest.spyOn(defenseApi, "get")
const getThesis = jest.spyOn(thesesApi, "detail")
const startDefense = jest.spyOn(defenseApi, "start")
const revertStatus = jest.spyOn(defenseApi, "revertStatus")

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
}

function buildDefense(status: string, statusHistory: DefenseStatusHistoryEntry[] = []): DefenseData {
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
    statusLabel: STATUS_LABELS[status] ?? status,
    createdAt: "2026-11-01T12:00:00Z",
    updatedAt: "2026-11-01T12:00:00Z",
    members: [],
    statusHistory,
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
  startDefense.mockReset()
  revertStatus.mockReset()
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

test("prefills the edit modal with the São Paulo start time", async () => {
  getDefense.mockResolvedValue({ defense: buildDefense("SCHEDULED") })
  render(<DefenseCommittee defenseId="defense-1" goBack={() => undefined} canStartClose />)

  userEvent.click(await screen.findByRole("button", { name: "Editar agendamento" }))
  expect(screen.getByLabelText("Data")).toHaveProperty("value", "2026-11-16")
  expect(screen.getByLabelText("Horário de início")).toHaveProperty("value", "17:00")
  expect(screen.getByLabelText("Duração da banca")).toHaveProperty("value", "120")
  expect(screen.getByText("Término previsto: 19:00")).toBeTruthy()
})

const STATUS_ACTIONS = ["Iniciar banca", "Encerrar banca", "Cancelar banca", "Reverter status"]

function visibleStatusActions(): string[] {
  return STATUS_ACTIONS.filter((name) => screen.queryByRole("button", { name }) !== null)
}

function renderCommittee(defense: DefenseData, props: { canStartClose?: boolean; isAdmin?: boolean } = {}) {
  getDefense.mockResolvedValue({ defense })
  render(<DefenseCommittee defenseId="defense-1" goBack={() => undefined} {...props} />)
}

test.each([
  ["SCHEDULED", "Agendada", 0],
  ["IN_PROGRESS", "Em andamento", 1],
  ["COMPLETED", "Concluída", 3],
  ["CANCELLED", "Cancelada", 1],
])("timeline for %s highlights %s with %i completed step(s)", async (status, currentLabel, doneCount) => {
  renderCommittee(buildDefense(status))
  const steps = await screen.findByRole("list", { name: "Etapas da banca" })
  const current = within(steps).getByRole("listitem", { current: "step" })
  expect(current.textContent).toContain(currentLabel)
  expect(within(steps).queryAllByText(/etapa concluída/)).toHaveLength(doneCount)
})

test("marks the cancelled step with the cancellation state", async () => {
  renderCommittee(buildDefense("CANCELLED"))
  const steps = await screen.findByRole("list", { name: "Etapas da banca" })
  const current = within(steps).getByRole("listitem", { current: "step" })
  expect(within(current).getByText(/banca cancelada/)).toBeTruthy()
  expect(within(steps).queryByText("Em andamento")).toBeNull()
})

test("renders the history with scheduling, system transitions and reasons", async () => {
  renderCommittee(
    buildDefense("IN_PROGRESS", [
      {
        previousStatus: null,
        previousStatusLabel: null,
        newStatus: "SCHEDULED",
        newStatusLabel: "Agendada",
        changedBy: "Coordenação Teste",
        reason: "Banca agendada.",
        createdAt: "2026-11-10T13:00:00+00:00",
      },
      {
        previousStatus: "SCHEDULED",
        previousStatusLabel: "Agendada",
        newStatus: "IN_PROGRESS",
        newStatusLabel: "Em andamento",
        changedBy: null,
        reason: "Iniciada automaticamente.",
        createdAt: "2026-11-16T20:00:00+00:00",
      },
    ]),
  )
  const history = await screen.findByRole("list", { name: "Histórico de status" })
  const entries = within(history).getAllByRole("listitem")
  expect(entries).toHaveLength(2)
  expect(entries[0]?.textContent).toMatch(/^.*Agendada10 de nov\.? de 2026.*10:00 · Coordenação TesteBanca agendada\.$/)
  expect(entries[0]?.textContent).not.toContain("→")
  expect(entries[1]?.textContent).toContain("Agendada → Em andamento")
  expect(entries[1]?.textContent).toMatch(/16 de nov\.? de 2026.*17:00 · Sistema/)
  expect(entries[1]?.textContent).toContain("Iniciada automaticamente.")
})

test("shows a discreet note when there is no status history", async () => {
  renderCommittee(buildDefense("SCHEDULED"))
  const note = await screen.findByText("Sem histórico registrado para esta banca.")
  expect(note.getAttribute("role")).toBeNull()
  expect(note.className).toBe("defense-history-empty")
})

test.each([
  ["coordinator", "SCHEDULED", { canStartClose: true }, ["Iniciar banca", "Cancelar banca"]],
  ["coordinator", "IN_PROGRESS", { canStartClose: true }, ["Encerrar banca"]],
  ["coordinator", "COMPLETED", { canStartClose: true }, []],
  ["coordinator", "CANCELLED", { canStartClose: true }, []],
  ["admin", "IN_PROGRESS", { canStartClose: true, isAdmin: true }, ["Encerrar banca", "Reverter status"]],
  ["admin", "CANCELLED", { canStartClose: true, isAdmin: true }, ["Reverter status"]],
  ["committee member", "SCHEDULED", {}, []],
])("%s on a %s defense sees %j", async (_profile, status, props, expected) => {
  renderCommittee(buildDefense(status), props)
  await screen.findByText("Dados da banca")
  expect(visibleStatusActions()).toEqual(expected)
})

test("advisor of the thesis can start and cancel; advisor of another thesis sees no actions", async () => {
  getDefense.mockResolvedValue({ defense: buildDefense("SCHEDULED") })
  getThesis.mockResolvedValue(thesisAdvisedBy("advisor-1"))
  const { unmount } = render(
    <DefenseCommittee defenseId="defense-1" goBack={() => undefined} isAdvisor currentUserId="advisor-1" />,
  )
  expect(await screen.findByRole("button", { name: "Iniciar banca" })).toBeTruthy()
  expect(visibleStatusActions()).toEqual(["Iniciar banca", "Cancelar banca"])
  unmount()

  getThesis.mockResolvedValue(thesisAdvisedBy("someone-else"))
  render(<DefenseCommittee defenseId="defense-1" goBack={() => undefined} isAdvisor currentUserId="advisor-1" />)
  await screen.findByText("Dados da banca")
  await waitFor(() => expect(getThesis).toHaveBeenCalledTimes(2))
  await act(async () => {
    await Promise.resolve()
  })
  expect(visibleStatusActions()).toEqual([])
})

test("keeps the top card free of status action buttons", async () => {
  renderCommittee(buildDefense("SCHEDULED"), { canStartClose: true })
  await screen.findByText("Dados da banca")
  expect(screen.getAllByRole("button", { name: "Iniciar banca" })).toHaveLength(1)
  expect(screen.getAllByRole("button", { name: "Cancelar banca" })).toHaveLength(1)
  expect(screen.getByRole("button", { name: "Atualizar" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Voltar" })).toBeTruthy()
})

test("confirms before starting and reloads the defense afterwards", async () => {
  startDefense.mockResolvedValue({ defense: buildDefense("IN_PROGRESS") })
  renderCommittee(buildDefense("SCHEDULED"), { canStartClose: true })
  userEvent.click(await screen.findByRole("button", { name: "Iniciar banca" }))

  const dialog = screen.getByRole("dialog")
  expect(dialog.textContent).toContain("A banca passa para Em andamento e os membros já podem avaliar.")
  expect(startDefense).not.toHaveBeenCalled()

  getDefense.mockResolvedValue({ defense: buildDefense("IN_PROGRESS") })
  const confirmButtons = screen.getAllByRole("button", { name: "Iniciar banca" })
  const confirmInDialog = confirmButtons.find((button) => dialog.contains(button))
  if (!confirmInDialog) throw new Error("confirm button not found")
  userEvent.click(confirmInDialog)

  await waitFor(() => expect(startDefense).toHaveBeenCalledWith("defense-1"))
  await waitFor(() => expect(getDefense).toHaveBeenCalledTimes(2))
  expect(await screen.findByRole("button", { name: "Encerrar banca" })).toBeTruthy()
  expect(screen.queryByRole("dialog")).toBeNull()
})

test.each([403, 404])("shows a neutral message when the backend answers %i", async (status) => {
  startDefense.mockRejectedValue(new ApiError("detalhe técnico", status))
  renderCommittee(buildDefense("SCHEDULED"), { canStartClose: true })
  userEvent.click(await screen.findByRole("button", { name: "Iniciar banca" }))
  const dialog = screen.getByRole("dialog")
  const confirmInDialog = screen.getAllByRole("button", { name: "Iniciar banca" }).find((button) => dialog.contains(button))
  if (!confirmInDialog) throw new Error("confirm button not found")
  userEvent.click(confirmInDialog)

  expect((await screen.findByRole("alert")).textContent).toContain("Você não tem permissão para esta ação.")
  expect(screen.getByText("Dados da banca")).toBeTruthy()
})

test("requires a reason to revert and sends it", async () => {
  revertStatus.mockRejectedValue(new ApiError("detalhe técnico", 404))
  renderCommittee(buildDefense("CANCELLED"), { canStartClose: true, isAdmin: true })
  userEvent.click(await screen.findByRole("button", { name: "Reverter status" }))
  const dialog = screen.getByRole("dialog")
  const confirm = screen.getAllByRole("button", { name: "Reverter status" }).find((button) => dialog.contains(button))
  if (!confirm) throw new Error("confirm button not found")
  expect(confirm).toHaveProperty("disabled", true)

  userEvent.type(screen.getByLabelText(/Motivo/), "Cancelada por engano")
  expect(confirm).toHaveProperty("disabled", false)
  userEvent.click(confirm)
  await waitFor(() => expect(revertStatus).toHaveBeenCalledWith("defense-1", "Cancelada por engano"))
  expect((await screen.findByRole("alert")).textContent).toContain("Você não tem permissão para esta ação.")
})
