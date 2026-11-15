import { afterAll, expect, jest, test } from "@jest/globals"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { defenseApi, type DefenseListParams } from "../api/client"
import DefenseScheduling from "./DefenseScheduling"

const listDefenses = jest.spyOn(defenseApi, "list")
const listSchedulable = jest.spyOn(defenseApi, "schedulableTheses")

afterAll(() => {
  jest.restoreAllMocks()
})

function emptyPage(count: number) {
  return { count, page: 1, pageSize: 10, totalPages: 1, lastPageCount: 0, results: [] }
}

test("keeps the tab counter on the unfiltered total while the list is filtered", async () => {
  // A contagem da aba usa pageSize=1 sem filtros; a lista filtrada não devolve nada.
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
