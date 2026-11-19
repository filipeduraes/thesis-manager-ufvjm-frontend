import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen, within } from "@testing-library/react"
import ChartCanvas from "./ChartCanvas"
import LazyChart from "./LazyChart"

beforeEach(() => {
  // jsdom não implementa canvas: o componente deve renderizar só a tabela acessível.
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
})

afterAll(() => {
  jest.restoreAllMocks()
})

const SERIES = [
  { label: "Aprovadas", values: [3, 2] },
  { label: "Reprovadas", values: [1, 0] },
]

test("names the canvas and repeats every value in a screen-reader table", () => {
  render(<ChartCanvas kind="bar" title="Resultados por ano" labels={["2025", "2026"]} series={SERIES} />)

  expect(screen.getByRole("img", { name: "Resultados por ano" })).toBeTruthy()
  const table = screen.getByRole("table", { name: "Resultados por ano" })
  expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Categoria", "Aprovadas", "Reprovadas"])
  const row2025 = within(table).getByRole("row", { name: /2025/ })
  expect(within(row2025).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["3", "1"])
})

test("LazyChart shows a loading status and then the chart", async () => {
  render(<LazyChart kind="line" title="Bancas por ano" labels={["2025"]} series={[{ label: "Bancas", values: [4] }]} />)

  expect(screen.getByRole("status").textContent).toBe("Carregando gráfico…")
  expect(await screen.findByRole("table", { name: "Bancas por ano" })).toBeTruthy()
})
