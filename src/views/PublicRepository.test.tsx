import { beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ApiError, repositoryApi, type PublicRepositoryPage } from "../api/client"
import type { PublicRepositoryFilters, PublicRepositoryThesis, PublicRepositoryThesisDetail } from "../types"
import PublicRepository from "./PublicRepository"

const search = jest.spyOn(repositoryApi, "search")
const filters = jest.spyOn(repositoryApi, "filters")
const detail = jest.spyOn(repositoryApi, "detail")
const download = jest.spyOn(repositoryApi, "download")

const SHA = "b".repeat(64)

function work(id: string, title: string): PublicRepositoryThesis {
  return {
    id,
    referenceCode: `TCC-${id}`,
    type: "MONOGRAPH",
    typeLabel: "Monografia",
    title,
    abstract: `Resumo de ${title}`,
    journal: "",
    origin: "WORKFLOW",
    course: { id: "course-1", name: "Engenharia Ambiental", code: "EAM" },
    advisor: { id: "advisor-1", name: "Helena Prado" },
    authors: [{ id: `a-${id}`, position: 1, isMainAuthor: true, name: "Camila Nunes", user: null }],
    authorNames: ["Camila Nunes"],
    keywords: ["Água"],
    publishedAt: "2024-06-01T12:00:00Z",
    defenseDate: "2024-05-10",
    defenseYear: 2024,
    currentFile: {
      id: `f-${id}`,
      versionNumber: 1,
      originalFilename: "tcc.pdf",
      sizeBytes: 2048,
      sha256: SHA,
      downloadUrl: `/api/v1/public/theses/${id}/download`,
      previewUrl: `/api/v1/public/theses/${id}/download?disposition=inline`,
    },
  }
}

function resultPage(results: PublicRepositoryThesis[], count = results.length, totalPages = 1, page = 1): PublicRepositoryPage {
  return { count, page, pageSize: 10, totalPages, lastPageCount: results.length, next: null, previous: null, results, ordering: "recent" }
}

const FILTERS: PublicRepositoryFilters = {
  courses: [{ id: "course-1", name: "Engenharia Ambiental", code: "EAM", count: 3 }],
  advisors: [{ id: "advisor-1", name: "Helena Prado", count: 2 }],
  years: [
    { year: 2026, count: 1 },
    { year: 2019, count: 1 },
    { year: 1998, count: 1 },
  ],
  keywords: [
    { name: "Água", value: "água", count: 2 },
    { name: "Educação", value: "educação", count: 1 },
  ],
}

function lastSearch() {
  const calls = search.mock.calls
  return calls[calls.length - 1][0]
}

beforeEach(() => {
  search.mockReset().mockResolvedValue(resultPage([work("t1", "Gestão hídrica no Vale")]))
  filters.mockReset().mockResolvedValue(FILTERS)
  detail.mockReset()
  download.mockReset().mockResolvedValue(undefined)
})

test("lista as monografias publicadas da API com o total real e sem dados de exemplo", async () => {
  search.mockResolvedValue(resultPage([work("t1", "Gestão hídrica no Vale")], 1))
  render(<PublicRepository go={jest.fn()} />)

  expect(await screen.findByText("Gestão hídrica no Vale")).toBeTruthy()
  expect(screen.getByRole("heading", { name: "1 monografia encontrada" })).toBeTruthy()
  expect(screen.queryByText(/248/)).toBeNull()
  expect(screen.getByText(/Orientação: Helena Prado/)).toBeTruthy()
  expect(screen.queryByText(/@/)).toBeNull()
  expect(lastSearch()).toEqual(expect.objectContaining({ q: "", page: 1, pageSize: 10, keywords: [] }))
})

test("usa os anos de defesa devolvidos por /filters, sem faixa fixa", async () => {
  render(<PublicRepository go={jest.fn()} />)
  const yearSelect = await screen.findByLabelText("Ano de defesa")
  await within(yearSelect).findByRole("option", { name: "2026 (1)" })
  const years = within(yearSelect).getAllByRole("option").map((option) => option.textContent)
  expect(years).toEqual(["Todos os anos", "2026 (1)", "2019 (1)", "1998 (1)"])
})

test("aplica busca geral, curso, orientador, ano e palavras-chave e volta à primeira página", async () => {
  search.mockResolvedValue(resultPage([work("t1", "Gestão hídrica no Vale")], 25, 3))
  render(<PublicRepository go={jest.fn()} />)
  await screen.findByText("Gestão hídrica no Vale")

  userEvent.click(screen.getByRole("button", { name: "Página 2" }))
  await waitFor(() => expect(lastSearch()).toEqual(expect.objectContaining({ page: 2 })))

  userEvent.type(screen.getByRole("textbox", { name: "Buscar no repositório" }), "  água   doce ")
  userEvent.selectOptions(screen.getByLabelText("Curso"), "course-1")
  userEvent.selectOptions(screen.getByLabelText("Orientador"), "advisor-1")
  userEvent.selectOptions(screen.getByLabelText("Ano de defesa"), "2019")
  const keyword = await screen.findByRole("button", { name: "Água (2)" })
  userEvent.click(keyword)
  expect(keyword.getAttribute("aria-pressed")).toBe("true")
  userEvent.click(screen.getByRole("button", { name: "Pesquisar" }))

  await waitFor(() =>
    expect(lastSearch()).toEqual(
      expect.objectContaining({
        q: "água doce",
        courseId: "course-1",
        advisorId: "advisor-1",
        year: 2019,
        keywords: ["água"],
        page: 1,
      }),
    ),
  )

  userEvent.selectOptions(screen.getByLabelText("Ordenar resultados"), "title")
  await waitFor(() => expect(lastSearch()).toEqual(expect.objectContaining({ ordering: "title", page: 1 })))
})

test("limpar filtros mantém o texto e remove curso, ano e palavras-chave", async () => {
  render(<PublicRepository go={jest.fn()} />)
  await screen.findByText("Gestão hídrica no Vale")
  userEvent.type(screen.getByRole("textbox", { name: "Buscar no repositório" }), "água")
  userEvent.selectOptions(screen.getByLabelText("Curso"), "course-1")
  userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }))
  await waitFor(() => expect(lastSearch()).toEqual(expect.objectContaining({ courseId: "course-1" })))

  userEvent.click(screen.getByRole("button", { name: "Limpar" }))
  await waitFor(() => expect(lastSearch()).toEqual(expect.objectContaining({ q: "água", courseId: undefined, keywords: [] })))
  expect(screen.getByLabelText("Curso")).toHaveProperty("value", "")
})

test("mostra o estado vazio e permite limpar a busca", async () => {
  search.mockResolvedValue(resultPage([], 0))
  render(<PublicRepository go={jest.fn()} />)
  expect(await screen.findByText("Ainda não há monografias publicadas no repositório.")).toBeTruthy()

  userEvent.type(screen.getByRole("textbox", { name: "Buscar no repositório" }), "inexistente")
  userEvent.click(screen.getByRole("button", { name: "Pesquisar" }))
  expect(await screen.findByText("Tente remover filtros ou usar termos mais abrangentes.")).toBeTruthy()
  expect(screen.getByRole("heading", { name: "0 monografias encontradas" })).toBeTruthy()
  userEvent.click(screen.getByRole("button", { name: "Limpar busca" }))
  await waitFor(() => expect(lastSearch()).toEqual(expect.objectContaining({ q: "" })))
})

test("explica o limite de requisições (429) e o parâmetro inválido (400) e permite tentar de novo", async () => {
  search.mockRejectedValueOnce(new ApiError("Muitas requisições.", 429))
  render(<PublicRepository go={jest.fn()} />)
  expect(await screen.findByText("Muitas buscas em pouco tempo. Aguarde alguns instantes e tente novamente.")).toBeTruthy()

  search.mockRejectedValueOnce(new ApiError("Um inteiro válido é necessário.", 400))
  userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
  expect(await screen.findByText(/Não foi possível aplicar a busca: Um inteiro válido é necessário\./)).toBeTruthy()

  userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }))
  expect(await screen.findByText("Gestão hídrica no Vale")).toBeTruthy()
})

test("abre o detalhe com resumo, autores, orientador, curso, ano, palavras-chave, SHA-256 e download", async () => {
  const thesisDetail: PublicRepositoryThesisDetail = {
    ...work("t1", "Gestão hídrica no Vale"),
    authors: [
      { id: "a1", position: 1, isMainAuthor: true, name: "Camila Nunes", user: null },
      { id: "a2", position: 2, isMainAuthor: false, name: "Rafael Costa", user: { id: "u2", name: "Rafael Costa" } },
    ],
    authorNames: ["Camila Nunes", "Rafael Costa"],
    keywords: ["Água", "Tecnologia social"],
    currentFile: { downloadUrl: "/api/v1/public/theses/t1/download", previewUrl: "/api/v1/public/theses/t1/download?disposition=inline" },
    integrity: { algorithm: "SHA-256", sha256: SHA, sizeBytes: 2048, versionNumber: 2, hashVerifiedAt: "2024-06-01T12:00:00Z" },
    fileVersions: [
      { versionNumber: 2, isCurrent: true, sha256: SHA, sizeBytes: 2048, uploadedAt: "2024-06-01T12:00:00Z" },
      { versionNumber: 1, isCurrent: false, sha256: "c".repeat(64), sizeBytes: 1024, uploadedAt: "2024-05-01T12:00:00Z" },
    ],
  }
  detail.mockResolvedValue({ thesis: thesisDetail })
  render(<PublicRepository go={jest.fn()} />)
  userEvent.click(await screen.findByRole("button", { name: "Ver detalhes" }))

  const dialog = await screen.findByRole("dialog", { name: "Gestão hídrica no Vale" })
  expect(detail).toHaveBeenCalledWith("t1", expect.anything())
  expect(within(dialog).getByText("Resumo de Gestão hídrica no Vale")).toBeTruthy()
  expect(within(dialog).getByText("Rafael Costa")).toBeTruthy()
  expect(within(dialog).getByText("Camila Nunes · Autor principal")).toBeTruthy()
  expect(within(dialog).getByText("Engenharia Ambiental (EAM)")).toBeTruthy()
  expect(within(dialog).getByText("2024")).toBeTruthy()
  expect(within(dialog).getByText("10 de maio de 2024")).toBeTruthy()
  expect(within(dialog).getByText("Tecnologia social")).toBeTruthy()
  expect(within(dialog).getByLabelText("Hash SHA-256 do PDF publicado").textContent).toBe(SHA)
  expect(within(dialog).getByText("Verificado")).toBeTruthy()
  expect(within(dialog).getByText(/Versão 1 · SHA-256/)).toBeTruthy()

  userEvent.click(within(dialog).getByRole("button", { name: "Baixar PDF completo" }))
  await waitFor(() => expect(download).toHaveBeenCalledWith("/api/v1/public/theses/t1/download", "TCC-t1.pdf"))

  download.mockRejectedValueOnce(new ApiError("Limite.", 429))
  userEvent.click(within(dialog).getByRole("button", { name: "Baixar PDF completo" }))
  expect(await within(dialog).findByText("Muitos downloads em pouco tempo. Aguarde um minuto e tente novamente.")).toBeTruthy()

  userEvent.click(within(dialog).getByRole("button", { name: "Fechar detalhes" }))
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("baixa o PDF direto da listagem pela URL pública devolvida pela API", async () => {
  render(<PublicRepository go={jest.fn()} />)
  userEvent.click(await screen.findByRole("button", { name: "Baixar PDF" }))
  await waitFor(() => expect(download).toHaveBeenCalledWith("/api/v1/public/theses/t1/download", "TCC-t1.pdf"))
})

test("cabeçalho do visitante oferece Entrar e não exibe o botão Sobre sem página", async () => {
  const go = jest.fn()
  render(<PublicRepository go={go} />)
  await screen.findByText("Gestão hídrica no Vale")
  const header = screen.getByRole("navigation", { name: "Navegação do repositório" })
  expect(within(header).queryByRole("button", { name: "Sobre" })).toBeNull()
  expect(within(header).queryByRole("button", { name: "Voltar ao sistema" })).toBeNull()
  userEvent.click(within(header).getByRole("button", { name: "Entrar" }))
  expect(go).toHaveBeenCalledWith("login")
})

test("com sessão ativa o cabeçalho troca Entrar por Voltar ao sistema, que leva ao Início", async () => {
  const go = jest.fn()
  render(<PublicRepository go={go} hasSession />)
  await screen.findByText("Gestão hídrica no Vale")
  const header = screen.getByRole("navigation", { name: "Navegação do repositório" })
  expect(within(header).queryByRole("button", { name: "Entrar" })).toBeNull()
  userEvent.click(within(header).getByRole("button", { name: "Voltar ao sistema" }))
  expect(go).toHaveBeenCalledWith("dashboard")
})

test("botão Repositório do cabeçalho volta ao topo e limpa a busca", async () => {
  const scrollTo = jest.spyOn(window, "scrollTo").mockImplementation(() => undefined)
  render(<PublicRepository go={jest.fn()} />)
  await screen.findByText("Gestão hídrica no Vale")
  userEvent.type(screen.getByRole("textbox", { name: "Buscar no repositório" }), "água")
  userEvent.selectOptions(screen.getByLabelText("Curso"), "course-1")
  userEvent.click(screen.getByRole("button", { name: "Pesquisar" }))
  await waitFor(() => expect(lastSearch()).toEqual(expect.objectContaining({ q: "água", courseId: "course-1" })))

  const header = screen.getByRole("navigation", { name: "Navegação do repositório" })
  userEvent.click(within(header).getByRole("button", { name: "Repositório" }))
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" })
  await waitFor(() => expect(lastSearch()).toEqual(expect.objectContaining({ q: "", courseId: undefined, keywords: [] })))
  expect(screen.getByRole("textbox", { name: "Buscar no repositório" })).toHaveProperty("value", "")
  expect(screen.getByLabelText("Curso")).toHaveProperty("value", "")
  scrollTo.mockRestore()
})

test("embutido no layout do sistema, não repete o cabeçalho nem o rodapé públicos", async () => {
  render(<PublicRepository go={jest.fn()} embedded />)
  expect(await screen.findByRole("heading", { name: "Repositório de Monografias" })).toBeTruthy()
  expect(screen.queryByRole("navigation", { name: "Navegação do repositório" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Entrar" })).toBeNull()
})
