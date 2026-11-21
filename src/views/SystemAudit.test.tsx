import { beforeEach, expect, jest, test } from "@jest/globals"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { adminApi, type AuditLogsPage } from "../api/client"
import SystemAudit from "./SystemAudit"

const auditLogs = jest.spyOn(adminApi, "auditLogs")
const exportAuditLogs = jest.spyOn(adminApi, "exportAuditLogs")

function auditPage(actor: string, count = 61): AuditLogsPage {
  return {
    count,
    next: null,
    previous: null,
    results: [{
      id: actor,
      timestamp: "2026-11-18T13:00:00Z",
      actor,
      role: "ADMIN",
      action: "LOGIN",
      entityType: "User",
      entityId: "u-1",
      origin: "Rede institucional",
      hash: "abc",
    }],
  }
}

beforeEach(() => {
  auditLogs.mockReset()
  exportAuditLogs.mockReset().mockResolvedValue(undefined)
})

test("navega pelo histórico e apresenta o total informado pela API", async () => {
  auditLogs.mockResolvedValueOnce(auditPage("Primeiro registro")).mockResolvedValueOnce(auditPage("Último registro"))
  render(<SystemAudit />)

  expect(await screen.findByText("Primeiro registro")).toBeTruthy()
  expect(screen.getByText("Total de registros: 61")).toBeTruthy()
  userEvent.click(screen.getByRole("button", { name: "Próxima página" }))
  expect(await screen.findByText("Último registro")).toBeTruthy()
  expect(screen.queryByText("Primeiro registro")).toBeNull()
  expect(screen.getByRole("button", { name: "Página 2" }).getAttribute("aria-current")).toBe("page")
  expect(auditLogs.mock.calls.map(([query]) => query)).toEqual(["?page=1&page_size=50", "?page=2&page_size=50"])
})

test("aplica e limpa filtros na primeira página e exporta somente os filtros aplicados", async () => {
  auditLogs.mockResolvedValue(auditPage("Registro"))
  render(<SystemAudit />)
  await screen.findByText("Registro")
  userEvent.click(screen.getByRole("button", { name: "Página 2" }))
  await screen.findByText("Registro")

  const keyword = screen.getByRole("textbox", { name: "Palavra-chave" })
  userEvent.type(keyword, "sessão")
  userEvent.selectOptions(screen.getByLabelText("Perfil"), "ADMIN")
  expect(auditLogs).toHaveBeenCalledTimes(2)

  const apply = screen.getByRole("button", { name: "Aplicar filtros" })
  userEvent.click(apply)
  userEvent.click(apply)
  await screen.findByText("Registro")
  expect(auditLogs).toHaveBeenCalledTimes(3)
  expect(auditLogs).toHaveBeenLastCalledWith("?role=ADMIN&q=sess%C3%A3o&page=1&page_size=50", expect.anything())

  userEvent.click(screen.getByRole("button", { name: "Página 2" }))
  await screen.findByText("Registro")
  expect(auditLogs).toHaveBeenLastCalledWith("?role=ADMIN&q=sess%C3%A3o&page=2&page_size=50", expect.anything())
  userEvent.clear(keyword)
  userEvent.click(screen.getByRole("button", { name: "Exportar log" }))
  expect(exportAuditLogs).toHaveBeenCalledWith("?role=ADMIN&q=sess%C3%A3o")

  userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }))
  await screen.findByText("Registro")
  expect(keyword).toHaveProperty("value", "")
  expect(screen.getByLabelText("Perfil")).toHaveProperty("value", "")
  expect(auditLogs).toHaveBeenCalledTimes(5)
  expect(auditLogs).toHaveBeenLastCalledWith("?page=1&page_size=50", expect.anything())
})

test("ignora uma resposta anterior mesmo quando a API conclui a consulta cancelada", async () => {
  let resolveOldPage: (page: AuditLogsPage) => void = () => undefined
  auditLogs.mockImplementationOnce(() => new Promise((resolve) => { resolveOldPage = resolve }))
  auditLogs.mockResolvedValueOnce(auditPage("Registro atual", 1))
  render(<SystemAudit />)

  expect(screen.getByRole("status")).toHaveProperty("textContent", "Carregando eventos…")
  userEvent.type(screen.getByRole("textbox", { name: "Palavra-chave" }), "atual")
  userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }))
  expect(await screen.findByText("Registro atual")).toBeTruthy()
  expect(auditLogs.mock.calls[0][1]?.aborted).toBe(true)

  await act(async () => { resolveOldPage(auditPage("Registro antigo")) })
  expect(screen.queryByText("Registro antigo")).toBeNull()
  expect(screen.getByText("Total de registros: 1")).toBeTruthy()
})

test("distingue falha de carregamento de uma consulta sem registros", async () => {
  auditLogs.mockRejectedValueOnce(new Error("Falha ao consultar a auditoria."))
  auditLogs.mockResolvedValueOnce({ count: 0, next: null, previous: null, results: [] })
  render(<SystemAudit />)

  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Falha ao consultar a auditoria.")
  expect(screen.queryByText("Nenhum evento encontrado.")).toBeNull()
  userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }))
  expect(await screen.findByText("Nenhum evento encontrado.")).toBeTruthy()
  expect(screen.getByText("Total de registros: 0")).toBeTruthy()
})
