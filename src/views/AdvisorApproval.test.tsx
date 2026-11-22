import { beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { repositoryApi, thesesApi, type PaginatedResponse, type ThesisListItem } from "../api/client"
import AdvisorApproval from "./AdvisorApproval"
import { publishedThesis } from "./repository/publishedThesisFixture"

const list = jest.spyOn(thesesApi, "list")
const detail = jest.spyOn(thesesApi, "detail")
const courses = jest.spyOn(repositoryApi, "courses")

function emptyPage(): PaginatedResponse<ThesisListItem> {
  return { count: 0, page: 1, pageSize: 10, totalPages: 1, lastPageCount: 0, results: [] }
}

beforeEach(() => {
  list.mockReset().mockResolvedValue(emptyPage())
  detail.mockReset()
  courses.mockReset().mockResolvedValue({ count: 0, results: [] })
})

test("oferece o cadastro de acervo para coordenação e administração, não para orientadores", async () => {
  const { unmount } = render(<AdvisorApproval profile="Orientador" />)
  await screen.findByText("Nenhuma monografia encontrada")
  expect(screen.queryByRole("button", { name: "Cadastrar monografia do acervo" })).toBeNull()
  unmount()

  render(<AdvisorApproval profile="Coordenador" />)
  userEvent.click(await screen.findByRole("button", { name: "Cadastrar monografia do acervo" }))
  expect(screen.getByRole("navigation", { name: "Caminho" }).textContent).toContain("Monografias")
  expect(screen.getByRole("heading", { name: "Cadastrar monografia do acervo" })).toBeTruthy()
  userEvent.click(screen.getByRole("button", { name: "Monografias" }))
  expect(await screen.findByRole("heading", { name: "Acompanhamento e aprovação" })).toBeTruthy()
})

test("mostra a gestão da publicação no detalhe conforme as permissões do backend", async () => {
  detail.mockResolvedValue({ thesis: publishedThesis({ canEditPublished: true, canUnpublish: true }) })
  render(<AdvisorApproval profile="Administrador" initialThesisId="thesis-1" />)

  expect(await screen.findByRole("heading", { name: "Gestão da publicação" })).toBeTruthy()
  expect(screen.getByText("Camila Nunes · Engenharia Ambiental")).toBeTruthy()
  expect(screen.getByText("Cadastro manual de acervo")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Editar metadados" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Despublicar" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: /Excluir/ })).toBeNull()
})

test("oculta a gestão da publicação sem as flags, mesmo para administrador", async () => {
  detail.mockResolvedValue({ thesis: publishedThesis() })
  render(<AdvisorApproval profile="Administrador" initialThesisId="thesis-1" />)
  expect(await screen.findByText("Camila Nunes · Engenharia Ambiental")).toBeTruthy()
  expect(screen.queryByRole("heading", { name: "Gestão da publicação" })).toBeNull()
})
