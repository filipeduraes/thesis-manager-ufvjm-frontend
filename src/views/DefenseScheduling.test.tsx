import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { defenseApi, type DefenseListParams } from "../api/client"
import DefenseScheduling from "./DefenseScheduling"

const listDefenses = jest.spyOn(defenseApi, "list")
const listSchedulable = jest.spyOn(defenseApi, "schedulableTheses")

beforeEach(() => {
  window.sessionStorage.clear()
})

afterAll(() => {
  jest.restoreAllMocks()
})

function emptyPage(count: number) {
  return { count, page: 1, pageSize: 10, totalPages: 1, lastPageCount: 0, results: [] }
}

test("keeps the tab counter on the unfiltered total while the list is filtered", async () => {  // A contagem da aba usa pageSize=1 sem filtros; a lista filtrada não devolve nada.
  listDefenses.mockImplementation((params: DefenseListParams = {}) =>
    Promise.resolve(emptyPage(params.pageSize === 1 ? 7 : 0)),
  )
  listSchedulable.mockResolvedValue(emptyPage(0))
  render(<DefenseScheduling onEvaluate={() => undefined} onOpenCommittee={() => undefined} />)

  userEvent.click(await screen.findByRole("tab", { name: "Bancas 7" }))
  userEvent.selectOptions(await screen.findByLabelText("Filtrar por status"), "CANCELLED")
  await waitFor(() => expect(listDefenses).toHaveBeenCalledWith(expect.objectContaining({ status: "CANCELLED" })))

  expect(await screen.findByText("0 banca(s) encontrada(s)")).toBeTruthy()
  expect(screen.getByRole("tab", { name: "Bancas 7" })).toBeTruthy()
  expect(screen.queryByText(/Consulte as bancas visíveis/)).toBeNull()
})

test("restores the selected tab and the list filters when the screen is reopened", async () => {
  listDefenses.mockResolvedValue(emptyPage(0))
  listSchedulable.mockResolvedValue(emptyPage(0))
  const { unmount } = render(
    <DefenseScheduling onEvaluate={() => undefined} onOpenCommittee={() => undefined} />,
  )
  userEvent.click(await screen.findByRole("tab", { name: "Bancas 0" }))
  const searchInput = await screen.findByPlaceholderText("Buscar aluno, título, código ou local...")
  userEvent.type(searchInput, "Maria{enter}")
  await waitFor(() => expect(listDefenses).toHaveBeenCalledWith(expect.objectContaining({ q: "Maria" })))
  unmount()

  render(<DefenseScheduling onEvaluate={() => undefined} onOpenCommittee={() => undefined} />)
  const restoredTab = await screen.findByRole("tab", { name: "Bancas 0" })
  expect(restoredTab.getAttribute("aria-selected")).toBe("true")
  const restoredSearch = await screen.findByPlaceholderText("Buscar aluno, título, código ou local...")
  expect(restoredSearch).toHaveProperty("value", "Maria")
})
