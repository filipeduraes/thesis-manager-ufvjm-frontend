import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ApiError, defenseApi, type DefenseListItem, type DefenseViewerMembership } from "../../api/client"
import PresentedDefenseList from "./PresentedDefenseList"
import { defensePermissions, type DefenseViewerKind } from "./defensePermissionsFixture"

const listDefenses = jest.spyOn(defenseApi, "list")

function buildDefense(
  id: string,
  title: string,
  membership: Partial<DefenseViewerMembership>,
  viewer: DefenseViewerKind = "manager",
): DefenseListItem {
  return {
    id,
    thesis: `thesis-${id}`,
    // 17:00Z = 14:00 em São Paulo; com 120 minutos termina às 16:00.
    scheduledDatetime: "2026-11-20T17:00:00Z",
    durationMinutes: 120,
    modality: "IN_PERSON",
    modalityLabel: "Presencial",
    location: "Sala 10",
    notes: "",
    status: "SCHEDULED",
    statusLabel: "Agendada",
    createdAt: "2026-11-01T12:00:00Z",
    updatedAt: "2026-11-01T12:00:00Z",
    members: [],
    thesisTitle: title,
    thesisReferenceCode: `REF-${id}`,
    student: null,
    advisor: null,
    viewerMembership: {
      isMember: false,
      memberId: null,
      role: null,
      roleLabel: null,
      canEvaluate: false,
      hasEvaluated: false,
      ...membership,
    },
    viewerPermissions: defensePermissions(viewer, "SCHEDULED"),
  }
}

function page(results: DefenseListItem[]) {
  return { count: results.length, page: 1, pageSize: 10, totalPages: 1, lastPageCount: results.length, results }
}

const noop = () => undefined

function renderList() {
  render(<PresentedDefenseList onEvaluate={noop} onOpenCommittee={noop} />)
}

function lastListParams() {
  return listDefenses.mock.calls[listDefenses.mock.calls.length - 1]?.[0]
}

beforeEach(() => {
  window.sessionStorage.clear()
  listDefenses.mockReset()
  listDefenses.mockResolvedValue(page([]))
})

afterAll(() => {
  jest.restoreAllMocks()
})

test("renders the table and shows evaluation actions according to viewerMembership", async () => {
  const pending = buildDefense("a", "Banca pendente", {
    isMember: true,
    role: "MEMBER",
    roleLabel: "Membro",
    canEvaluate: true,
  })
  const evaluated = {
    ...buildDefense("b", "Banca avaliada", { isMember: true, canEvaluate: true, hasEvaluated: true }),
    status: "IN_PROGRESS",
  }
  const notMember = buildDefense("c", "Banca sem participação", {})
  listDefenses.mockResolvedValue(page([pending, evaluated, notMember]))
  renderList()

  expect(await screen.findByText("Banca pendente")).toBeTruthy()
  expect(screen.getByText("3 banca(s) encontrada(s)")).toBeTruthy()
  expect(screen.getAllByText("Autor não informado")).toHaveLength(3)
  expect(screen.getAllByText(/20 de nov\.? de 2026 · 14:00 às 16:00/)).toHaveLength(3)
  expect(screen.getAllByText("Sala 10")).toHaveLength(3)
  expect(screen.getByText("Membro")).toBeTruthy()

  expect(screen.getAllByRole("button", { name: "Minha avaliação" })).toHaveLength(1)
  expect(screen.getAllByRole("button", { name: "Editar minha avaliação" })).toHaveLength(1)
  expect(screen.getAllByText("Parecer enviado")).toHaveLength(1)
  expect(screen.getAllByRole("button", { name: "Gerenciar banca" })).toHaveLength(3)
})

test("does not offer editing for closed defenses or members without permission", async () => {
  const completed = {
    ...buildDefense("completed", "Banca encerrada", { isMember: true, canEvaluate: true, hasEvaluated: true }),
    status: "COMPLETED",
  }
  const denied = {
    ...buildDefense("denied", "Banca sem permissão", { isMember: true, canEvaluate: false, hasEvaluated: true }),
    status: "IN_PROGRESS",
  }
  listDefenses.mockResolvedValue(page([completed, denied]))
  renderList()

  expect(await screen.findByText("Banca encerrada")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Editar minha avaliação" })).toBeNull()
  expect(screen.getAllByText("Parecer enviado")).toHaveLength(2)
})

test("shows the manage action only for viewers with permission", async () => {
  const managed = buildDefense("a", "Banca do meu curso", {}, "manager")
  const asMember = buildDefense("b", "Banca de outro curso", { isMember: true, roleLabel: "Membro" }, "none")
  listDefenses.mockResolvedValue(page([managed, asMember]))
  renderList()

  expect(await screen.findByText("Banca do meu curso")).toBeTruthy()
  expect(screen.getAllByRole("button", { name: "Gerenciar banca" })).toHaveLength(1)
  expect(screen.queryByRole("button", { name: "Ver banca" })).toBeNull()
})

test("shows the empty state when the backend returns no defenses", async () => {
  renderList()
  expect(await screen.findByText("Nenhuma banca encontrada")).toBeTruthy()
  expect(screen.getByText("0 banca(s) encontrada(s)")).toBeTruthy()
})

test("shows the backend error message and retries", async () => {
  listDefenses.mockRejectedValueOnce(new ApiError("Você não tem permissão para consultar bancas.", 403))
  renderList()

  expect((await screen.findByRole("alert")).textContent).toContain("Você não tem permissão para consultar bancas.")
  userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
  expect(await screen.findByText("Nenhuma banca encontrada")).toBeTruthy()
  expect(listDefenses).toHaveBeenCalledTimes(2)
})

test("searches on Enter and on Filtrar, sending q", async () => {
  renderList()
  await screen.findByText("Nenhuma banca encontrada")

  const search = screen.getByPlaceholderText("Buscar aluno, título, código ou local...")
  userEvent.type(search, "Maria{enter}")
  await waitFor(() => expect(lastListParams()).toMatchObject({ q: "Maria", page: 1 }))
  expect(await screen.findByText("0 banca(s) encontrada(s) para “Maria”")).toBeTruthy()

  userEvent.clear(search)
  userEvent.type(search, "  Sala 10 ")
  userEvent.click(screen.getByRole("button", { name: "Filtrar" }))
  await waitFor(() => expect(lastListParams()).toMatchObject({ q: "Sala 10" }))
})

test("filters by status and by pending evaluation", async () => {
  renderList()
  await screen.findByText("Nenhuma banca encontrada")

  userEvent.selectOptions(screen.getByLabelText("Filtrar por status"), "IN_PROGRESS")
  await waitFor(() => expect(lastListParams()).toMatchObject({ status: "IN_PROGRESS", page: 1 }))

  userEvent.click(screen.getByLabelText("Somente aguardando meu parecer"))
  await waitFor(() => expect(lastListParams()).toMatchObject({ status: "IN_PROGRESS", pendingEvaluation: true }))
  expect(await screen.findByText("Não há bancas aguardando o seu parecer neste momento.")).toBeTruthy()
})

test("clears every filter", async () => {
  renderList()
  await screen.findByText("Nenhuma banca encontrada")

  const search = screen.getByPlaceholderText("Buscar aluno, título, código ou local...")
  userEvent.type(search, "Maria{enter}")
  userEvent.selectOptions(screen.getByLabelText("Filtrar por status"), "CANCELLED")
  userEvent.click(screen.getByLabelText("Somente aguardando meu parecer"))
  await waitFor(() =>
    expect(lastListParams()).toMatchObject({ q: "Maria", status: "CANCELLED", pendingEvaluation: true }),
  )

  userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }))
  await waitFor(() =>
    expect(lastListParams()).toEqual({ q: "", status: "", pendingEvaluation: undefined, page: 1, pageSize: 10 }),
  )
  expect(search).toHaveProperty("value", "")
  expect(screen.getByLabelText("Filtrar por status")).toHaveProperty("value", "")
  expect(screen.getByLabelText("Somente aguardando meu parecer")).toHaveProperty("checked", false)
})
