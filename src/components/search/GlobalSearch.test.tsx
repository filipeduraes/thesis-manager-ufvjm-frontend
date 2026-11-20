import { afterEach, expect, jest, test } from "@jest/globals"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import * as api from "../../api/client"
import type { PaginatedResponse, PublicThesisSummary } from "../../api/client"
import { menuByProfile } from "../../data/navigation"
import Topbar from "../layout/Topbar"

const { publicSearchApi, thesesApi } = api

function page<T>(results: T[]): PaginatedResponse<T> {
  return { results, count: results.length, page: 1, pageSize: 5, totalPages: 1, lastPageCount: results.length }
}

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

test("opens for students with either shortcut and finds only allowed page aliases", () => {
  const navigate = jest.fn()
  render(<Topbar openMenu={() => {}} menuItems={menuByProfile.Aluno} canReadDirectory={false}
    onSearchNavigate={navigate} onSessionExpired={() => {}} />)

  fireEvent.keyDown(window, { key: "k", ctrlKey: true })
  const dialog = screen.getByRole("dialog")
  const input = within(dialog).getByRole("searchbox")
  expect(document.activeElement).toBe(input)
  fireEvent.change(input, { target: { value: "submissao" } })
  fireEvent.keyDown(input, { key: "Enter" })
  expect(navigate).toHaveBeenCalledWith({ kind: "page", page: "submission" })

  fireEvent.keyDown(window, { key: "k", metaKey: true })
  expect(screen.getByRole("dialog")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Auditoria" })).toBeNull()
  fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" })
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("debounces real sources, scopes student theses and ignores outdated responses", async () => {
  jest.useFakeTimers()
  const theses = jest.spyOn(thesesApi, "list").mockResolvedValue(page([]))
  jest.spyOn(publicSearchApi, "advisors").mockResolvedValue(page([]))
  let completeFirst = (_page: PaginatedResponse<PublicThesisSummary>) => {}
  const publications = jest.spyOn(publicSearchApi, "theses")
    .mockImplementationOnce(() => new Promise((resolve) => { completeFirst = resolve }))
    .mockResolvedValue(page([{ id: "current", title: "Publicação atual", course: { id: "course", name: "Computação", code: "CC" } }]))

  render(<Topbar openMenu={() => {}} menuItems={menuByProfile.Aluno} canReadDirectory={false}
    onSearchNavigate={() => {}} onSessionExpired={() => {}} />)
  fireEvent.click(screen.getByRole("button", { name: "Pesquisar no sistema" }))
  const input = screen.getByRole("searchbox")
  fireEvent.change(input, { target: { value: "re" } })
  act(() => { jest.advanceTimersByTime(350) })
  expect(publications).not.toHaveBeenCalled()

  fireEvent.change(input, { target: { value: "redes" } })
  act(() => { jest.advanceTimersByTime(349) })
  expect(publications).not.toHaveBeenCalled()
  await act(async () => { jest.advanceTimersByTime(1) })
  expect(theses).toHaveBeenCalledWith({ q: "redes", scope: "authored", pageSize: 5 }, expect.any(AbortSignal))
  const firstSignal = publications.mock.calls[0][2]

  fireEvent.change(input, { target: { value: "dados" } })
  expect(firstSignal?.aborted).toBe(true)
  await act(async () => { jest.advanceTimersByTime(350) })
  await act(async () => {
    completeFirst(page([{ id: "old", title: "Publicação antiga", course: { id: "course", name: "Computação", code: "CC" } }]))
  })
  expect(screen.getByRole("button", { name: /Publicação atual/ })).toBeTruthy()
  expect(screen.queryByRole("button", { name: /Publicação antiga/ })).toBeNull()
  fireEvent.change(input, { target: { value: "da" } })
  fireEvent.change(input, { target: { value: "dados" } })
  await act(async () => { jest.advanceTimersByTime(350) })
  expect(publications).toHaveBeenCalledTimes(2)
  expect(theses).toHaveBeenCalledTimes(3)
  expect(screen.getByRole("button", { name: /Publicação atual/ })).toBeTruthy()
})

function mockAdminSources() {
  const person = { id: "person-1", name: "Ana Lima", email: "ana@ufvjm.edu.br" }
  const theses = jest.spyOn(thesesApi, "list").mockResolvedValue(page([]))
  const defenses = jest.spyOn(api.defenseApi, "list").mockResolvedValue(page([]))
  const publications = jest.spyOn(publicSearchApi, "theses").mockResolvedValue(page([]))
  const advisors = jest.spyOn(publicSearchApi, "advisors").mockResolvedValue(page([person, { id: "person-2", name: person.name }]))
  const directory = jest.spyOn(api.directoryApi, "users").mockResolvedValue(page([{ ...person, roles: ["ADVISOR"] }]))
  const admin = jest.spyOn(api.adminApi, "users").mockResolvedValue(page([{
    ...person, role: "Orientador", roleCode: "ADVISOR", status: "Ativo", initials: "AL",
    avatarUrl: null, course: null, courseId: null, lastAccess: null, roles: [],
  }]))
  const courses = jest.spyOn(api.adminApi, "courses").mockResolvedValue(page([]))
  const departments = jest.spyOn(api.adminApi, "departments").mockResolvedValue({ results: [], count: 0 })
  return { person, theses, defenses, publications, advisors, directory, admin, courses, departments }
}

test("deduplicates people by ID, preserves both actions and restores focus after the summary", async () => {
  jest.useFakeTimers()
  const { person } = mockAdminSources()
  const navigate = jest.fn()
  render(<Topbar openMenu={() => {}} menuItems={menuByProfile.Administrador} canReadDirectory
    onSearchNavigate={navigate} onSessionExpired={() => {}} />)

  const trigger = screen.getByRole("button", { name: "Pesquisar no sistema" })
  trigger.focus()
  fireEvent.click(trigger)
  const input = screen.getByRole("searchbox")
  fireEvent.change(input, { target: { value: "Ana Lima" } })
  await act(async () => { jest.advanceTimersByTime(350) })
  expect(screen.getAllByText(person.name)).toHaveLength(2)
  expect(screen.queryByRole("region", { name: "Pessoas" })).toBeNull()
  const adminRow = within(screen.getByRole("region", { name: "Usuários" }))
  const primary = adminRow.getByRole("button", { name: /Ana Lima Orientador/ })
  const summary = adminRow.getByRole("button", { name: "Ver resumo de Ana Lima" })
  fireEvent.keyDown(input, { key: "ArrowDown" })
  expect(document.activeElement).toBe(primary)
  fireEvent.keyDown(primary, { key: "ArrowDown" })
  expect(document.activeElement).toBe(summary)
  fireEvent.click(summary)
  expect(screen.getByText(person.email)).toBeTruthy()
  const back = screen.getByRole("button", { name: "Voltar aos resultados" })
  const close = screen.getByRole("button", { name: "Fechar pesquisa" })
  expect(document.activeElement).toBe(back)
  fireEvent.keyDown(back, { key: "Tab", shiftKey: true })
  expect(document.activeElement).toBe(close)
  fireEvent.keyDown(close, { key: "Tab" })
  expect(document.activeElement).toBe(back)
  fireEvent.click(back)
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ver resumo de Ana Lima" }))
  fireEvent.click(within(screen.getByRole("region", { name: "Usuários" }))
    .getByRole("button", { name: /Ana Lima Orientador/ }))
  expect(navigate).toHaveBeenCalledWith({ kind: "page", page: "users", query: person.email })
  expect(document.activeElement).toBe(trigger)
})

test("sends an email only to authorized people APIs and preserves the directory when admin access is unavailable", async () => {
  jest.useFakeTimers()
  const { person, admin, directory, ...otherSources } = mockAdminSources()
  admin.mockRejectedValue(new api.ApiError("Not found", 404))
  const navigate = jest.fn()
  render(<Topbar openMenu={() => {}} menuItems={menuByProfile.Administrador} canReadDirectory
    onSearchNavigate={navigate} onSessionExpired={() => {}} />)

  fireEvent.click(screen.getByRole("button", { name: "Pesquisar no sistema" }))
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: person.email } })
  await act(async () => { jest.advanceTimersByTime(350) })
  expect(admin).toHaveBeenCalledTimes(1)
  expect(directory).toHaveBeenCalledWith(person.email, 5, expect.any(AbortSignal))
  for (const source of Object.values(otherSources)) expect(source).not.toHaveBeenCalled()
  fireEvent.click(within(screen.getByRole("region", { name: "Pessoas" })).getByRole("button", { name: /Ana Lima/ }))
  expect(screen.getByText(person.email)).toBeTruthy()
  expect(navigate).not.toHaveBeenCalled()
})

test("downloads a publication using its public detail and resets the search on session change", async () => {
  jest.useFakeTimers()
  jest.spyOn(thesesApi, "list").mockResolvedValue(page([]))
  jest.spyOn(publicSearchApi, "advisors").mockResolvedValue(page([]))
  const publication = { id: "thesis-1", title: "Redes distribuídas", course: { id: "course", name: "Computação", code: "CC" } }
  jest.spyOn(publicSearchApi, "theses").mockResolvedValue(page([publication]))
  const path = "/api/v1/public/theses/thesis-1/download"
  const detail = jest.spyOn(publicSearchApi, "thesis").mockResolvedValue({
    thesis: {
      ...publication,
      abstract: "Resumo da monografia",
      student: { name: "Autora" },
      advisor: { name: "Orientadora" },
      keywords: [],
      currentFile: { downloadUrl: path, storedFile: { originalFilename: "tcc.pdf" } },
    },
  })
  const download = jest.spyOn(api, "downloadApiFile").mockResolvedValue(undefined)
  const props = {
    openMenu: () => {},
    menuItems: menuByProfile.Aluno,
    canReadDirectory: false,
    onSearchNavigate: () => {},
    onSessionExpired: () => {},
  }
  const { rerender } = render(<Topbar key="student-1" {...props} />)
  fireEvent.click(screen.getByRole("button", { name: "Pesquisar no sistema" }))
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "redes" } })
  await act(async () => { jest.advanceTimersByTime(350) })
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Redes distribuídas/ })) })
  expect(detail).toHaveBeenCalledWith("thesis-1", expect.any(AbortSignal))
  expect(screen.getByText("Resumo da monografia")).toBeTruthy()
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Baixar PDF" })) })
  expect(download).toHaveBeenCalledWith(path, "tcc.pdf", expect.any(AbortSignal))

  rerender(<Topbar key="student-2" {...props} />)
  expect(screen.queryByRole("dialog")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Pesquisar no sistema" }))
  expect(screen.getByRole<HTMLInputElement>("searchbox").value).toBe("")
})
