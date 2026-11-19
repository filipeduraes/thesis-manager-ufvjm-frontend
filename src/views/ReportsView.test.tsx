import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ApiError, reportsApi } from "../api/client"
import { buildReportsOverview, populatedReportsOverview } from "./dashboard/reportsOverviewFixture"
import ReportsView from "./ReportsView"

const overview = jest.spyOn(reportsApi, "overview")
const exportPdf = jest.spyOn(reportsApi, "exportPdf")

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
  overview.mockResolvedValue(populatedReportsOverview())
  exportPdf.mockReset()
  exportPdf.mockResolvedValue(undefined)
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

test("exports the PDF with the current filters through the API layer", async () => {
  render(<ReportsView />)
  await screen.findByText("87,5%")

  userEvent.selectOptions(screen.getByLabelText("Curso"), "course-si")
  userEvent.selectOptions(screen.getByLabelText("Ano de defesa"), "2025")
  userEvent.click(screen.getByRole("button", { name: "Exportar PDF" }))

  await waitFor(() => expect(exportPdf).toHaveBeenCalledWith({ courseId: "course-si", advisorId: undefined, year: 2025 }))
  expect(await screen.findByRole("button", { name: "Exportar PDF" })).toHaveProperty("disabled", false)
  expect(screen.queryByRole("alert")).toBeNull()
})

test("shows a loading state and blocks repeated clicks while the PDF is generated", async () => {
  let finishExport: () => void = () => undefined
  exportPdf.mockReturnValue(new Promise<void>((resolve) => { finishExport = resolve }))
  render(<ReportsView />)
  await screen.findByText("87,5%")

  userEvent.click(screen.getByRole("button", { name: "Exportar PDF" }))
  const busyButton = await screen.findByRole("button", { name: "Gerando PDF…" })
  expect(busyButton).toHaveProperty("disabled", true)
  expect(screen.getByText("Gerando o PDF com os filtros atuais…")).toBeTruthy()
  userEvent.click(busyButton)
  expect(exportPdf).toHaveBeenCalledTimes(1)

  finishExport()
  expect(await screen.findByRole("button", { name: "Exportar PDF" })).toHaveProperty("disabled", false)
})

test.each([
  [403, "Você não tem permissão para exportar estes relatórios."],
  [429, "Muitas exportações em pouco tempo. Aguarde um minuto e tente novamente."],
  [500, "Não foi possível gerar o PDF. Tente novamente."],
])("explains a %i from the PDF export in Portuguese", async (status, message) => {
  exportPdf.mockRejectedValueOnce(new ApiError("detalhe do backend", status))
  render(<ReportsView />)
  await screen.findByText("87,5%")

  userEvent.click(screen.getByRole("button", { name: "Exportar PDF" }))

  expect((await screen.findByRole("alert")).textContent).toContain(message)
  expect(screen.getByRole("button", { name: "Exportar PDF" })).toHaveProperty("disabled", false)
})

test("shows the generic message when the export fails without an HTTP status", async () => {
  exportPdf.mockRejectedValueOnce(new TypeError("Failed to fetch"))
  render(<ReportsView />)
  await screen.findByText("87,5%")

  userEvent.click(screen.getByRole("button", { name: "Exportar PDF" }))

  expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível gerar o PDF. Tente novamente.")
  userEvent.click(screen.getByRole("button", { name: "Exportar PDF" }))
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
})
