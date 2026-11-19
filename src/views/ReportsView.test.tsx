import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ApiError, reportsApi } from "../api/client"
import { buildReportsOverview, populatedReportsOverview } from "./dashboard/reportsOverviewFixture"
import ReportsView from "./ReportsView"

const overview = jest.spyOn(reportsApi, "overview")

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
  overview.mockResolvedValue(populatedReportsOverview())
})

afterAll(() => {
  jest.restoreAllMocks()
})

test("renders backend indicators, charts and the per-course table", async () => {
  render(<ReportsView />)

  expect(await screen.findByText("87,5%")).toBeTruthy()
  expect(overview).toHaveBeenCalledWith({ courseId: undefined, advisorId: undefined, year: undefined })
  expect(screen.getByText("Dados de todos os cursos.")).toBeTruthy()
  expect(screen.getAllByText("Taxa de aprovação em bancas").length).toBeGreaterThan(0)
  expect(screen.getByText("61,5 dias")).toBeTruthy()
  expect(screen.getByRole("table", { name: "Monografias por curso" })).toBeTruthy()
  expect(screen.getByRole("table", { name: "Resultados das bancas concluídas" })).toBeTruthy()
  expect(screen.getByRole("table", { name: "Bancas concluídas por ano de defesa" })).toBeTruthy()
  const courseTable = screen.getByRole("table", { name: "Indicadores por curso" })
  expect(within(courseTable).getByText("Ciência da Computação")).toBeTruthy()
  expect(within(courseTable).getByText("83,3%")).toBeTruthy()
})

test("sends the selected filters to the backend and clears them", async () => {
  render(<ReportsView />)
  await screen.findByText("87,5%")

  userEvent.selectOptions(screen.getByLabelText("Curso"), "course-si")
  await waitFor(() => expect(overview).toHaveBeenLastCalledWith({ courseId: "course-si", advisorId: undefined, year: undefined }))
  userEvent.selectOptions(screen.getByLabelText("Ano de defesa"), "2025")
  await waitFor(() => expect(overview).toHaveBeenLastCalledWith({ courseId: "course-si", advisorId: undefined, year: 2025 }))

  userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }))
  await waitFor(() => expect(overview).toHaveBeenLastCalledWith({ courseId: undefined, advisorId: undefined, year: undefined }))
})

test("shows the coordinator scope and an empty state without data", async () => {
  overview.mockResolvedValue(buildReportsOverview({ scope: "COORDINATED_COURSES" }))
  render(<ReportsView />)

  expect(await screen.findByText("Dados dos cursos que você coordena.")).toBeTruthy()
  expect(screen.getByText("Nenhum dado para os filtros selecionados")).toBeTruthy()
})

test("explains a 403 from the backend and offers a retry", async () => {
  overview.mockRejectedValueOnce(new ApiError("Acesso restrito a coordenadores e administradores.", 403))
  render(<ReportsView />)

  expect(await screen.findByText("Você não tem permissão para ver estes dados.")).toBeTruthy()
  userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
  expect(await screen.findByText("87,5%")).toBeTruthy()
})
