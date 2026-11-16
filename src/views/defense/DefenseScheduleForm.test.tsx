import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { defenseApi, type DefenseCommitteeMember, type DefenseData, type ThesisListItem } from "../../api/client"
import DefenseScheduleForm from "./DefenseScheduleForm"

const listSchedulable = jest.spyOn(defenseApi, "schedulableTheses")
const scheduleDefense = jest.spyOn(defenseApi, "schedule")
const addExternalMember = jest.spyOn(defenseApi, "addExternalMember")

function schedulableThesis(): ThesisListItem {
  // Somente os campos exibidos pelo formulário importam para o teste.
  const partial: Pick<ThesisListItem, "id" | "title" | "referenceCode" | "status" | "statusLabel" | "student" | "course"> = {
    id: "thesis-1",
    title: "Monografia apta",
    referenceCode: "TCC-001",
    status: "ADVISOR_APPROVED",
    statusLabel: "Aprovada pelo orientador",
    student: { id: "s-1", name: "Aluna Teste", email: "aluna@ufvjm.edu.br" },
    course: { id: "c-1", name: "Sistemas de Informação", code: "SI" },
  }
  return partial as ThesisListItem
}

function scheduledDefense(): DefenseData {
  return {
    id: "defense-9",
    thesis: "thesis-1",
    scheduledDatetime: "2030-01-10T17:00:00Z",
    durationMinutes: 120,
    modality: "IN_PERSON",
    modalityLabel: "Presencial",
    location: "",
    notes: "",
    status: "SCHEDULED",
    statusLabel: "Agendada",
    createdAt: "2026-11-15T12:00:00Z",
    updatedAt: "2026-11-15T12:00:00Z",
    members: [],
  }
}

function createdMember(name: string): DefenseCommitteeMember {
  return {
    id: "ext-1",
    role: "MEMBER",
    roleLabel: "Membro",
    name,
    email: "paula@externo.org",
    institution: "",
    hasConflict: false,
    conflictReason: "",
    isInstitutional: false,
    avatarUrl: null,
    availabilityStatus: "PENDING",
    availabilityStatusLabel: "Pendente",
    availabilityRespondedAt: null,
    availabilityNote: "",
    createdAt: "2026-11-15T12:00:00Z",
    evaluation: null,
  }
}

beforeEach(() => {
  listSchedulable.mockReset()
  scheduleDefense.mockReset()
  addExternalMember.mockReset()
  listSchedulable.mockResolvedValue({ count: 1, page: 1, pageSize: 100, totalPages: 1, lastPageCount: 1, results: [schedulableThesis()] })
})

afterAll(() => {
  jest.restoreAllMocks()
})

/** Picks the thesis and fills a valid in-person schedule. */
async function fillSchedule() {
  userEvent.click(await screen.findByRole("button", { name: "Selecionar" }))
  userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Monografia apta/ }))
  fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2030-01-10" } })
  fireEvent.change(screen.getByLabelText("Horário de início"), { target: { value: "14:00" } })
  userEvent.click(screen.getByRole("button", { name: "2h" }))
  userEvent.click(screen.getByRole("radio", { name: "Presencial" }))
}

test("shows the external member token after scheduling and opens the committee only after closing it", async () => {
  scheduleDefense.mockResolvedValue({ defense: scheduledDefense() })
  addExternalMember.mockResolvedValue({
    member: createdMember("Paula Externa"),
    accessToken: "UFVJM-AAAA-BBBB-CCCC-DDDD",
    accessTokenExpiresAt: "2026-12-15T15:00:00Z",
  })
  const onOpenCommittee = jest.fn()
  render(<DefenseScheduleForm onOpenCommittee={onOpenCommittee} />)
  await fillSchedule()

  userEvent.click(screen.getByRole("button", { name: "Convidar externo" }))
  userEvent.type(screen.getByPlaceholderText("Nome do avaliador"), "Paula Externa")
  userEvent.type(screen.getByPlaceholderText("avaliador@email.com"), "paula@externo.org")
  userEvent.click(screen.getByRole("button", { name: "Adicionar membro externo" }))
  userEvent.click(await screen.findByRole("button", { name: "Confirmar agendamento" }))

  const dialog = await screen.findByRole("dialog", { name: "Token de acesso" })
  expect(within(dialog).getByText("UFVJM-AAAA-BBBB-CCCC-DDDD")).toBeTruthy()
  expect(within(dialog).getByText("Guarde este token: ele não será exibido novamente.")).toBeTruthy()
  expect(addExternalMember).toHaveBeenCalledWith("defense-9", expect.objectContaining({ name: "Paula Externa" }))
  expect(onOpenCommittee).not.toHaveBeenCalled()

  userEvent.click(within(dialog).getByRole("button", { name: "Concluir" }))
  expect(onOpenCommittee).toHaveBeenCalledWith("defense-9")
})

test("opens the committee right away when no external member was sent", async () => {
  scheduleDefense.mockResolvedValue({ defense: scheduledDefense() })
  const onOpenCommittee = jest.fn()
  render(<DefenseScheduleForm onOpenCommittee={onOpenCommittee} />)
  await fillSchedule()

  userEvent.click(screen.getByRole("button", { name: "Confirmar agendamento" }))
  await waitFor(() => expect(onOpenCommittee).toHaveBeenCalledWith("defense-9"))
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("asks for a valid meeting link when the defense is remote", async () => {
  scheduleDefense.mockResolvedValue({ defense: scheduledDefense() })
  render(<DefenseScheduleForm onOpenCommittee={() => undefined} />)
  await fillSchedule()

  expect(screen.getByLabelText(/Local da defesa/)).toHaveProperty("placeholder", "Sala / prédio")
  userEvent.click(screen.getByRole("radio", { name: "Remota" }))
  const link = screen.getByLabelText("Link da defesa")
  expect(link).toHaveProperty("placeholder", "https://...")
  expect(screen.queryByLabelText(/Local da defesa/)).toBeNull()
  const confirm = screen.getByRole("button", { name: "Confirmar agendamento" })
  expect(confirm).toHaveProperty("disabled", true)

  userEvent.type(link, "meet.google.com/abc")
  expect(screen.getByRole("alert").textContent).toBe("Para defesa remota, informe o link da reunião (URL http ou https).")
  expect(link.getAttribute("aria-invalid")).toBe("true")
  expect(confirm).toHaveProperty("disabled", true)

  userEvent.clear(link)
  userEvent.type(link, "https://meet.google.com/abc")
  expect(screen.queryByRole("alert")).toBeNull()
  expect(confirm).toHaveProperty("disabled", false)
  userEvent.click(confirm)
  await waitFor(() =>
    expect(scheduleDefense).toHaveBeenCalledWith(
      "thesis-1",
      expect.objectContaining({ modality: "REMOTE", location: "https://meet.google.com/abc" }),
    ),
  )
})
