import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen } from "@testing-library/react"
import { adminApi, type ExternalInvitationRecord } from "../api/client"
import AdminUsers from "./AdminUsers"

const listUsers = jest.spyOn(adminApi, "users")
const listCourses = jest.spyOn(adminApi, "courses")
const listInvitations = jest.spyOn(adminApi, "invitations")

function invitation(id: string, overrides: Partial<ExternalInvitationRecord> = {}): ExternalInvitationRecord {
  return {
    id,
    name: "Paula Externa",
    email: `${id}@externo.org`,
    institution: "UFMG",
    status: "PENDING",
    expiresAt: "2026-12-15T15:00:00Z",
    usedAt: null,
    sentAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  listUsers.mockReset()
  listCourses.mockReset()
  listInvitations.mockReset()
  listUsers.mockResolvedValue({ count: 0, page: 1, pageSize: 10, totalPages: 1, lastPageCount: 0, results: [] })
  listCourses.mockResolvedValue({ count: 0, page: 1, pageSize: 100, totalPages: 1, lastPageCount: 0, results: [] })
})

afterAll(() => {
  jest.restoreAllMocks()
})

test("no longer offers a standalone external invitation nor shows access codes", async () => {
  listInvitations.mockResolvedValue({
    results: [invitation("sent", { sentAt: "2026-11-21T13:30:00Z" }), invitation("queued")],
  })
  render(<AdminUsers />)

  expect(await screen.findByText("Convites externos")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Convidar membro externo" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Gerar token" })).toBeNull()
  expect(screen.getByText("Os convites são criados ao incluir um membro externo na banca. O código de acesso é enviado somente por e-mail.")).toBeTruthy()
  expect(screen.getByText("E-mail enviado em 21/11/2026")).toBeTruthy()
  expect(screen.getByText("Envio pendente")).toBeTruthy()
  expect(document.body.textContent).not.toMatch(/UFVJM-[A-Z0-9]{4}/)
  expect("createInvitation" in adminApi).toBe(false)
})
