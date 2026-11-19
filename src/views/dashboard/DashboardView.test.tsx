import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  adminApi,
  ApiError,
  defenseApi,
  reportsApi,
  thesesApi,
  type DefenseListItem,
  type PaginatedResponse,
  type StudentThesisContext,
  type ThesisListItem,
} from "../../api/client"
import type { Profile } from "../../types"
import DashboardView from "./DashboardView"
import { buildReportsOverview, populatedReportsOverview } from "./reportsOverviewFixture"

const overview = jest.spyOn(reportsApi, "overview")
const listDefenses = jest.spyOn(defenseApi, "list")
const listSchedulable = jest.spyOn(defenseApi, "schedulableTheses")
const listTheses = jest.spyOn(thesesApi, "list")
const myThesis = jest.spyOn(thesesApi, "myThesis")
const adminUsers = jest.spyOn(adminApi, "users")
const adminCourses = jest.spyOn(adminApi, "courses")
const auditLogs = jest.spyOn(adminApi, "auditLogs")

function page<T>(results: T[], count = results.length): PaginatedResponse<T> {
  return { count, page: 1, pageSize: 5, totalPages: 1, lastPageCount: results.length, results }
}

function schedulableThesis(): ThesisListItem {
  // Somente os campos exibidos pelo painel importam para o teste.
  const partial: Pick<ThesisListItem, "id" | "title" | "student" | "course" | "advisorApprovedAt"> = {
    id: "thesis-1",
    title: "Monografia apta",
    student: { id: "s-1", name: "Aluna Teste", email: "aluna@ufvjm.edu.br" },
    course: { id: "course-cc", name: "Ciência da Computação", code: "CC" },
    advisorApprovedAt: "2026-11-10T12:00:00Z",
  }
  return partial as ThesisListItem
}

function pendingDefense(): DefenseListItem {
  const partial: Pick<DefenseListItem, "id" | "thesisTitle" | "student" | "scheduledDatetime" | "statusLabel"> = {
    id: "defense-7",
    thesisTitle: "Monografia em banca",
    student: { id: "s-2", name: "Aluno Avaliado", email: "aluno@ufvjm.edu.br" },
    scheduledDatetime: "2026-11-20T17:00:00Z",
    statusLabel: "Em andamento",
  }
  return partial as DefenseListItem
}

const NO_THESIS: StudentThesisContext = {
  thesis: null,
  courses: [],
  advisors: [],
  defaultCourseId: null,
  limits: { maxPdfSizeMb: 50, maxDocumentSizeMb: 20, maxKeywords: 5 },
}

function renderDashboard(profiles: Profile[]) {
  const callbacks = { go: jest.fn(), review: jest.fn(), evaluate: jest.fn() }
  render(<DashboardView profiles={profiles} go={callbacks.go} review={callbacks.review} evaluate={callbacks.evaluate} />)
  return callbacks
}

beforeEach(() => {
  // jsdom não implementa canvas; o gráfico cai para a tabela acessível.
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
  overview.mockResolvedValue(populatedReportsOverview())
  listDefenses.mockResolvedValue(page([]))
  listSchedulable.mockResolvedValue(page([]))
  listTheses.mockResolvedValue(page([]))
  myThesis.mockResolvedValue(NO_THESIS)
  adminUsers.mockResolvedValue(page([], 42))
  adminCourses.mockResolvedValue(page([], 6))
  auditLogs.mockResolvedValue({ results: [] })
})

afterAll(() => {
  jest.restoreAllMocks()
})

// Regra do backend (accounts/services.py): o perfil Aluno nunca vem combinado com outro.
test("shows one section per role in the order Administrador, Coordenador, Orientador", async () => {
  renderDashboard(["Orientador", "Administrador", "Coordenador"])

  const headings = await screen.findAllByRole("heading", { level: 2, name: /^(Administração|Coordenação|Orientação)$/ })
  expect(headings.map((heading) => heading.textContent)).toEqual(["Administração", "Coordenação", "Orientação"])
  expect(screen.getByRole("region", { name: "Coordenação" })).toBeTruthy()
})

test("a student sees only the student dashboard, without section titles", async () => {
  renderDashboard(["Aluno"])

  expect(await screen.findByText("Nenhuma monografia cadastrada")).toBeTruthy()
  expect(screen.queryByRole("region")).toBeNull()
  expect(overview).not.toHaveBeenCalled()
})

test("a single role renders its dashboard without section titles", async () => {
  renderDashboard(["Coordenador"])

  expect(await screen.findByText("Taxa de aprovação em bancas")).toBeTruthy()
  expect(screen.queryByRole("heading", { name: "Coordenação" })).toBeNull()
})

test("coordinator dashboard shows backend indicators, the scheduling queue and the yearly chart", async () => {
  overview.mockResolvedValue(populatedReportsOverview("COORDINATED_COURSES"))
  listSchedulable.mockResolvedValue(page([schedulableThesis()], 3))
  const { go } = renderDashboard(["Coordenador"])

  expect(await screen.findByText("87,5%")).toBeTruthy()
  expect(overview).toHaveBeenCalledWith({ scope: "coordinated" })
  expect(screen.getByText("61,5 dias")).toBeTruthy()
  expect(screen.getByText("3 aguardando agendamento")).toBeTruthy()
  expect(screen.getByText("Aluna Teste")).toBeTruthy()
  const chartTable = await screen.findByRole("table", { name: "Resultados das bancas por ano de defesa" })
  expect(within(chartTable).getByRole("rowheader", { name: "2025" })).toBeTruthy()

  userEvent.click(screen.getByRole("button", { name: "Agendar banca" }))
  expect(go).toHaveBeenCalledWith("schedule")
  userEvent.click(screen.getByRole("button", { name: "Ver relatórios" }))
  expect(go).toHaveBeenCalledWith("reports")
})

test("coordinator dashboard explains empty data and a missing course link", async () => {
  overview.mockResolvedValue(buildReportsOverview({ scope: "COORDINATED_COURSES" }))
  renderDashboard(["Coordenador"])

  expect(await screen.findByText(/Nenhum curso está vinculado à sua coordenação/)).toBeTruthy()
  expect(screen.getByText("Nenhuma monografia aguardando banca")).toBeTruthy()
  expect(screen.getByText("Nenhuma banca agendada")).toBeTruthy()
  expect(screen.getByText("Ainda não há bancas concluídas")).toBeTruthy()
  // Sem bancas com resultado o backend manda null, exibido como travessão.
  expect(screen.getAllByText("—").length).toBeGreaterThan(0)
})

test("coordinator dashboard shows the error and retries", async () => {
  overview.mockRejectedValueOnce(new ApiError("Falha temporária no servidor.", 500))
  renderDashboard(["Coordenador"])

  expect(await screen.findByText("Falha temporária no servidor.")).toBeTruthy()
  userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
  expect(await screen.findByText("87,5%")).toBeTruthy()
  expect(overview).toHaveBeenCalledTimes(2)
})

test("admin dashboard keeps report indicators when admin areas answer 404", async () => {
  const hidden = new ApiError("Não encontrado.", 404)
  adminUsers.mockRejectedValue(hidden)
  adminCourses.mockRejectedValue(hidden)
  auditLogs.mockRejectedValue(hidden)
  renderDashboard(["Administrador"])

  expect(await screen.findByText("87,5%")).toBeTruthy()
  // O painel do administrador pede o relatório sem filtros (escopo ALL).
  expect(overview.mock.calls[0]).toEqual([])
  expect(screen.getAllByText("Indisponível neste acesso")).toHaveLength(2)
  expect(screen.getByText("A auditoria não está disponível neste acesso.")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Abrir auditoria" })).toBeNull()
})

test("admin dashboard shows user and course counts, the course chart and recent audit events", async () => {
  auditLogs.mockResolvedValue({
    results: [
      { id: "log-1", timestamp: "2026-11-18T13:00:00Z", actor: "Admin Teste", role: "ADMIN", action: "LOGIN", summary: "Login institucional", entityType: "User", entityId: "u-1", origin: "Rede institucional", hash: "abc" },
    ],
  })
  const { go } = renderDashboard(["Administrador"])

  expect(await screen.findByText("42")).toBeTruthy()
  expect(screen.getByText("6")).toBeTruthy()
  expect(adminUsers).toHaveBeenCalledWith("?status=Ativo&page_size=1")
  expect(screen.getByText("Login institucional")).toBeTruthy()
  const chartTable = await screen.findByRole("table", { name: "Monografias por curso" })
  expect(within(chartTable).getByRole("rowheader", { name: "CC" })).toBeTruthy()
  userEvent.click(screen.getByRole("button", { name: "Abrir auditoria" }))
  expect(go).toHaveBeenCalledWith("audit")
})

test("advisor dashboard lists defenses awaiting the advisor's evaluation", async () => {
  listDefenses.mockResolvedValue(page([pendingDefense()]))
  const { evaluate } = renderDashboard(["Orientador"])

  expect(await screen.findByText("Bancas a avaliar")).toBeTruthy()
  expect(listDefenses).toHaveBeenCalledWith({ pendingEvaluation: true, pageSize: 5 })
  userEvent.click(screen.getByRole("button", { name: "Avaliar" }))
  expect(evaluate).toHaveBeenCalledWith("defense-7")
})
