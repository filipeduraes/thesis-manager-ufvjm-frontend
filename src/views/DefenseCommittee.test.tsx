import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  ApiError,
  defenseApi,
  type DefenseCommitteeMember,
  type DefenseData,
  type DefenseStatusHistoryEntry,
} from "../api/client"
import DefenseCommittee from "./DefenseCommittee"
import { defensePermissions, type DefenseViewerKind } from "./defense/defensePermissionsFixture"

const getDefense = jest.spyOn(defenseApi, "get")
const startDefense = jest.spyOn(defenseApi, "start")
const revertStatus = jest.spyOn(defenseApi, "revertStatus")
const respondAvailability = jest.spyOn(defenseApi, "respondAvailability")

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
}

function buildDefense(status: string, statusHistory: DefenseStatusHistoryEntry[] = []): DefenseData {
  return {
    id: "defense-1",
    thesis: "thesis-1",
    scheduledDatetime: "2026-11-16T20:00:00Z",
    durationMinutes: 120,
    modality: "IN_PERSON",
    modalityLabel: "Presencial",
    location: "Auditório",
    notes: "",
    status,
    statusLabel: STATUS_LABELS[status] ?? status,
    createdAt: "2026-11-01T12:00:00Z",
    updatedAt: "2026-11-01T12:00:00Z",
    members: [],
    statusHistory,
  }
}

beforeEach(() => {
  getDefense.mockReset()
  startDefense.mockReset()
  revertStatus.mockReset()
  respondAvailability.mockReset()
})

afterAll(() => {
  jest.restoreAllMocks()
})

test("mostra aviso amarelo persistente no detalhe da banca", async () => {
  const defense = buildDefense("SCHEDULED")
  defense.scheduleWarnings = [{ memberName: "Profa. Membro", defenseId: "defense-2", scheduledDatetime: "2026-12-10T14:00:00Z", scheduledEndDatetime: "2026-12-10T16:00:00Z" }]
  renderCommittee(defense, "manager")

  expect(await screen.findByText("Horário próximo de outra banca")).toBeTruthy()
  expect(screen.getByText(/Profa\. Membro participa de outra banca/)).toBeTruthy()
})

test("coordinator sees edit and cancel actions and the defense details for a scheduled defense", async () => {
  renderCommittee(buildDefense("SCHEDULED"), "manager")

  expect(await screen.findByRole("button", { name: "Editar agendamento" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Cancelar banca" })).toBeTruthy()
  expect(screen.getByText("17:00 às 19:00")).toBeTruthy()
  expect(screen.getByText("2h")).toBeTruthy()
})

test("hides edit and cancel actions once the defense has started", async () => {
  renderCommittee(buildDefense("IN_PROGRESS"), "manager")

  expect(await screen.findByText("Dados da banca")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Editar agendamento" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Cancelar banca" })).toBeNull()
})

test("advisor manages only the defense of a thesis they advise", async () => {
  // Orientador da tese: o backend envia canManage e as ações de banca agendada.
  renderCommittee(buildDefense("SCHEDULED"), "manager")
  expect(await screen.findByRole("button", { name: "Editar agendamento" })).toBeTruthy()
})

test("advisor of another thesis does not see edit and cancel actions", async () => {
  renderCommittee(buildDefense("SCHEDULED"), "none")

  expect(await screen.findByText("Dados da banca")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Editar agendamento" })).toBeNull()
})

test("prefills the edit modal with the São Paulo start time", async () => {
  renderCommittee(buildDefense("SCHEDULED"), "manager")

  userEvent.click(await screen.findByRole("button", { name: "Editar agendamento" }))
  expect(screen.getByLabelText("Data")).toHaveProperty("value", "2026-11-16")
  expect(screen.getByLabelText("Horário de início")).toHaveProperty("value", "17:00")
  expect(screen.getByLabelText("Duração da banca")).toHaveProperty("value", "120")
  expect(screen.getByText("Término previsto: 19:00")).toBeTruthy()
})

const STATUS_ACTIONS = ["Iniciar banca", "Encerrar banca", "Cancelar banca", "Reverter status"]

function visibleStatusActions(): string[] {
  return STATUS_ACTIONS.filter((name) => screen.queryByRole("button", { name }) !== null)
}

/** Renders the screen with the `viewerPermissions` the backend sends to `viewer` for this status. */
function renderCommittee(defense: DefenseData, viewer: DefenseViewerKind = "none") {
  getDefense.mockResolvedValue({ defense: withViewer(defense, viewer) })
  return render(<DefenseCommittee defenseId="defense-1" goBack={() => undefined} />)
}

function withViewer(defense: DefenseData, viewer: DefenseViewerKind): DefenseData {
  return { ...defense, viewerPermissions: defensePermissions(viewer, defense.status) }
}

test.each([
  ["SCHEDULED", "Agendada", 0],
  ["IN_PROGRESS", "Em andamento", 1],
  ["COMPLETED", "Concluída", 3],
  ["CANCELLED", "Cancelada", 1],
])("timeline for %s highlights %s with %i completed step(s)", async (status, currentLabel, doneCount) => {
  renderCommittee(buildDefense(status))
  const steps = await screen.findByRole("list", { name: "Etapas da banca" })
  const current = within(steps).getByRole("listitem", { current: "step" })
  expect(current.textContent).toContain(currentLabel)
  expect(within(steps).queryAllByText(/etapa concluída/)).toHaveLength(doneCount)
})

test("marks the cancelled step with the cancellation state", async () => {
  renderCommittee(buildDefense("CANCELLED"))
  const steps = await screen.findByRole("list", { name: "Etapas da banca" })
  const current = within(steps).getByRole("listitem", { current: "step" })
  expect(within(current).getByText(/banca cancelada/)).toBeTruthy()
  expect(within(steps).queryByText("Em andamento")).toBeNull()
})

test("renders the history with scheduling, system transitions and reasons", async () => {
  renderCommittee(
    buildDefense("IN_PROGRESS", [
      {
        previousStatus: null,
        previousStatusLabel: null,
        newStatus: "SCHEDULED",
        newStatusLabel: "Agendada",
        changedBy: "Coordenação Teste",
        reason: "Banca agendada.",
        createdAt: "2026-11-10T13:00:00+00:00",
      },
      {
        previousStatus: "SCHEDULED",
        previousStatusLabel: "Agendada",
        newStatus: "IN_PROGRESS",
        newStatusLabel: "Em andamento",
        changedBy: null,
        reason: "Iniciada automaticamente.",
        createdAt: "2026-11-16T20:00:00+00:00",
      },
    ]),
  )
  const history = await screen.findByRole("list", { name: "Histórico de status" })
  const entries = within(history).getAllByRole("listitem")
  expect(entries).toHaveLength(2)
  expect(entries[0]?.textContent).toMatch(/^.*Agendada10 de nov\.? de 2026.*10:00 · Coordenação TesteBanca agendada\.$/)
  expect(entries[0]?.textContent).not.toContain("→")
  expect(entries[1]?.textContent).toContain("Agendada → Em andamento")
  expect(entries[1]?.textContent).toMatch(/16 de nov\.? de 2026.*17:00 · Sistema/)
  expect(entries[1]?.textContent).toContain("Iniciada automaticamente.")
})

test("shows a discreet note when there is no status history", async () => {
  renderCommittee(buildDefense("SCHEDULED"))
  const note = await screen.findByText("Sem histórico registrado para esta banca.")
  expect(note.getAttribute("role")).toBeNull()
  expect(note.className).toBe("defense-history-empty")
})

test.each([
  ["coordinator", "SCHEDULED", "manager" as const, ["Iniciar banca", "Cancelar banca"]],
  ["coordinator", "IN_PROGRESS", "manager" as const, ["Encerrar banca"]],
  ["coordinator", "COMPLETED", "manager" as const, []],
  ["coordinator", "CANCELLED", "manager" as const, []],
  ["admin", "IN_PROGRESS", "admin" as const, ["Encerrar banca", "Reverter status"]],
  ["admin", "CANCELLED", "admin" as const, ["Reverter status"]],
  ["committee member", "SCHEDULED", "none" as const, []],
])("%s on a %s defense sees %j", async (_profile, status, viewer, expected) => {
  renderCommittee(buildDefense(status), viewer)
  await screen.findByText("Dados da banca")
  expect(visibleStatusActions()).toEqual(expected)
})

test("advisor of the thesis can start and cancel; advisor of another thesis sees no actions", async () => {
  const { unmount } = renderCommittee(buildDefense("SCHEDULED"), "manager")
  expect(await screen.findByRole("button", { name: "Iniciar banca" })).toBeTruthy()
  expect(visibleStatusActions()).toEqual(["Iniciar banca", "Cancelar banca"])
  unmount()

  renderCommittee(buildDefense("SCHEDULED"), "none")
  await screen.findByText("Dados da banca")
  expect(visibleStatusActions()).toEqual([])
})

test("keeps the top card free of status action buttons", async () => {
  renderCommittee(buildDefense("SCHEDULED"), "manager")
  await screen.findByText("Dados da banca")
  expect(screen.getAllByRole("button", { name: "Iniciar banca" })).toHaveLength(1)
  expect(screen.getAllByRole("button", { name: "Cancelar banca" })).toHaveLength(1)
  expect(screen.getByRole("button", { name: "Atualizar" })).toBeTruthy()
  expect(within(screen.getByRole("navigation", { name: "Caminho" })).getByRole("button", { name: "Bancas" })).toBeTruthy()
})

test("confirms before starting and reloads the defense afterwards", async () => {
  startDefense.mockResolvedValue({ defense: buildDefense("IN_PROGRESS") })
  renderCommittee({ ...buildDefense("SCHEDULED"), allMembersConfirmed: true }, "manager")
  userEvent.click(await screen.findByRole("button", { name: "Iniciar banca" }))

  const dialog = screen.getByRole("dialog")
  expect(dialog.textContent).toContain("A banca passa para Em andamento e os membros já podem avaliar.")
  expect(startDefense).not.toHaveBeenCalled()

  getDefense.mockResolvedValue({ defense: withViewer(buildDefense("IN_PROGRESS"), "manager") })
  const confirmButtons = screen.getAllByRole("button", { name: "Iniciar banca" })
  const confirmInDialog = confirmButtons.find((button) => dialog.contains(button))
  if (!confirmInDialog) throw new Error("confirm button not found")
  userEvent.click(confirmInDialog)

  await waitFor(() => expect(startDefense).toHaveBeenCalledWith("defense-1"))
  await waitFor(() => expect(getDefense).toHaveBeenCalledTimes(2))
  expect(await screen.findByRole("button", { name: "Encerrar banca" })).toBeTruthy()
  expect(screen.queryByRole("dialog")).toBeNull()
})

test.each([403, 404])("shows a neutral message when the backend answers %i", async (status) => {
  startDefense.mockRejectedValue(new ApiError("detalhe técnico", status))
  renderCommittee({ ...buildDefense("SCHEDULED"), allMembersConfirmed: true }, "manager")
  userEvent.click(await screen.findByRole("button", { name: "Iniciar banca" }))
  const dialog = screen.getByRole("dialog")
  const confirmInDialog = screen.getAllByRole("button", { name: "Iniciar banca" }).find((button) => dialog.contains(button))
  if (!confirmInDialog) throw new Error("confirm button not found")
  userEvent.click(confirmInDialog)

  expect((await screen.findByRole("alert")).textContent).toContain("Você não tem permissão para esta ação.")
  expect(screen.getByText("Dados da banca")).toBeTruthy()
})

test("requires a reason to revert and sends it", async () => {
  revertStatus.mockRejectedValue(new ApiError("detalhe técnico", 404))
  renderCommittee(buildDefense("CANCELLED"), "admin")
  userEvent.click(await screen.findByRole("button", { name: "Reverter status" }))
  const dialog = screen.getByRole("dialog")
  const confirm = screen.getAllByRole("button", { name: "Reverter status" }).find((button) => dialog.contains(button))
  if (!confirm) throw new Error("confirm button not found")
  expect(confirm).toHaveProperty("disabled", true)

  userEvent.type(screen.getByLabelText(/Motivo/), "Cancelada por engano")
  expect(confirm).toHaveProperty("disabled", false)
  userEvent.click(confirm)
  await waitFor(() => expect(revertStatus).toHaveBeenCalledWith("defense-1", "Cancelada por engano"))
  expect((await screen.findByRole("alert")).textContent).toContain("Você não tem permissão para esta ação.")
})

const AVAILABILITY_LABELS: Record<string, string> = { PENDING: "Pendente", CONFIRMED: "Confirmada", DECLINED: "Recusada" }

function buildMember(id: string, name: string, overrides: Partial<DefenseCommitteeMember> = {}): DefenseCommitteeMember {
  const availabilityStatus = overrides.availabilityStatus ?? "PENDING"
  return {
    id,
    role: "MEMBER",
    roleLabel: "Membro",
    name,
    email: `${id}@ufvjm.edu.br`,
    institution: "",
    hasConflict: false,
    conflictReason: "",
    isInstitutional: true,
    avatarUrl: null,
    availabilityStatus,
    availabilityStatusLabel: AVAILABILITY_LABELS[availabilityStatus] ?? availabilityStatus,
    availabilityRespondedAt: null,
    availabilityNote: "",
    createdAt: "2026-11-01T12:00:00Z",
    evaluation: null,
    ...overrides,
  }
}

function defenseWithMembers(status: string, members: DefenseCommitteeMember[]): DefenseData {
  const pending = members.filter((member) => member.role !== "ALTERNATE" && member.availabilityStatus !== "CONFIRMED")
  return {
    ...buildDefense(status),
    members,
    allMembersConfirmed: members.length > 0 && pending.length === 0,
    pendingConfirmations: pending.map((member) => ({
      memberId: member.id,
      name: member.name,
      role: member.role,
      roleLabel: member.roleLabel,
      availabilityStatus: member.availabilityStatus ?? "PENDING",
    })),
  }
}

test("shows the availability badge of each member, with the note when unavailable", async () => {
  renderCommittee(
    defenseWithMembers("SCHEDULED", [
      buildMember("ana", "Ana Pendente"),
      buildMember("bruno", "Bruno Confirmado", { availabilityStatus: "CONFIRMED" }),
      buildMember("carla", "Carla Indisponível", { availabilityStatus: "DECLINED", availabilityNote: "Viagem a congresso" }),
    ]),
    "manager",
  )
  expect(await screen.findByText("Ana Pendente")).toBeTruthy()
  expect(screen.getByText("Aguardando confirmação")).toBeTruthy()
  expect(screen.getByText("Confirmado")).toBeTruthy()
  expect(screen.getByText("Indisponível")).toBeTruthy()
  expect(screen.getByText("Observação: Viagem a congresso")).toBeTruthy()
})

test("disables Iniciar banca while confirmations are pending and explains why", async () => {
  renderCommittee(
    defenseWithMembers("SCHEDULED", [
      buildMember("ana", "Ana Pendente"),
      buildMember("carla", "Carla Indisponível", { availabilityStatus: "DECLINED" }),
      buildMember("davi", "Davi Suplente", { role: "ALTERNATE", roleLabel: "Suplente" }),
    ]),
    "manager",
  )
  const start = await screen.findByRole("button", { name: "Iniciar banca" })
  expect(start).toHaveProperty("disabled", true)
  expect(screen.getByText("Aguardando confirmação de: Ana Pendente, Carla Indisponível")).toBeTruthy()
  const describedBy = start.getAttribute("aria-describedby")
  const explanation = screen.getAllByRole("status").find((element) => element.id === describedBy)
  expect(explanation?.textContent).toContain("Aguardando confirmação de:")
  expect(explanation?.textContent).toContain("Ana Pendente, Carla Indisponível")
})

test("enables Iniciar banca once every titular member confirmed", async () => {
  renderCommittee(
    defenseWithMembers("SCHEDULED", [buildMember("ana", "Ana", { availabilityStatus: "CONFIRMED" })]),
    "manager",
  )
  const start = await screen.findByRole("button", { name: "Iniciar banca" })
  expect(start).toHaveProperty("disabled", false)
  expect(screen.queryByText(/Aguardando confirmação de/)).toBeNull()
})

test("signed-in member confirms availability on a scheduled defense", async () => {
  const me = buildMember("me", "Eu Mesmo")
  getDefense.mockResolvedValue({ defense: asViewer(defenseWithMembers("SCHEDULED", [me]), "me") })
  respondAvailability.mockResolvedValue({ member: { ...me, availabilityStatus: "CONFIRMED" } })
  render(<DefenseCommittee defenseId="defense-1" goBack={() => undefined}  />)

  userEvent.click(await screen.findByRole("button", { name: "Confirmar disponibilidade" }))
  await waitFor(() => expect(respondAvailability).toHaveBeenCalledWith("defense-1", "me", { status: "CONFIRMED" }))
  await waitFor(() => expect(getDefense).toHaveBeenCalledTimes(2))
})

test("signed-in member declines availability with a note", async () => {
  const me = buildMember("me", "Eu Mesmo")
  getDefense.mockResolvedValue({ defense: asViewer(defenseWithMembers("SCHEDULED", [me]), "me") })
  respondAvailability.mockResolvedValue({ member: { ...me, availabilityStatus: "DECLINED" } })
  render(<DefenseCommittee defenseId="defense-1" goBack={() => undefined}  />)

  userEvent.click(await screen.findByRole("button", { name: "Informar indisponibilidade" }))
  const dialog = screen.getByRole("dialog")
  userEvent.type(within(dialog).getByLabelText(/Observação/), "Banca no mesmo horário")
  userEvent.click(within(dialog).getByRole("button", { name: "Informar indisponibilidade" }))
  await waitFor(() =>
    expect(respondAvailability).toHaveBeenCalledWith("defense-1", "me", { status: "DECLINED", note: "Banca no mesmo horário" }),
  )
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
})

test("hides the availability answer when the user is not a member or the defense started", async () => {
  const me = buildMember("me", "Eu Mesmo")
  getDefense.mockResolvedValue({ defense: asViewer(defenseWithMembers("SCHEDULED", [me]), null) })
  const { unmount } = render(
    <DefenseCommittee defenseId="defense-1" goBack={() => undefined}  />,
  )
  await screen.findByText("Dados da banca")
  expect(screen.queryByRole("button", { name: "Confirmar disponibilidade" })).toBeNull()
  unmount()

  getDefense.mockResolvedValue({ defense: asViewer(defenseWithMembers("IN_PROGRESS", [me]), "me") })
  render(<DefenseCommittee defenseId="defense-1" goBack={() => undefined}  />)
  await screen.findByText("Dados da banca")
  expect(screen.queryByRole("button", { name: "Confirmar disponibilidade" })).toBeNull()
})

const addExternalMember = jest.spyOn(defenseApi, "addExternalMember")
const resendInvitation = jest.spyOn(defenseApi, "resendInvitation")
const regenerateInvitation = jest.spyOn(defenseApi, "regenerateInvitation")

const TOKEN_PATTERN = /UFVJM-[A-Z0-9]{4}/

function externalMember(id: string, name: string, overrides: Partial<DefenseCommitteeMember> = {}): DefenseCommitteeMember {
  return buildMember(id, name, {
    isInstitutional: false,
    email: `${id}@externo.org`,
    institution: "UFMG",
    invitationStatus: "PENDING",
    invitationStatusLabel: "Pendente",
    invitationExpiresAt: "2026-12-15T15:00:00Z",
    invitationSentAt: "2026-11-21T13:30:00Z",
    canResendInvitation: true,
    ...overrides,
  })
}

function resetInvitationMocks() {
  addExternalMember.mockReset()
  resendInvitation.mockReset()
  regenerateInvitation.mockReset()
}

test("adding an external member announces the e-mail and never shows an access code", async () => {
  resetInvitationMocks()
  const created = externalMember("ext", "Paula Externa", { email: "ext@externo.org", invitationSentAt: null })
  addExternalMember.mockResolvedValue({ member: created })
  renderCommittee(buildDefense("SCHEDULED"), "manager")

  userEvent.click(await screen.findByRole("button", { name: "Membro externo" }))
  userEvent.type(screen.getByPlaceholderText("Nome do avaliador"), "Paula Externa")
  userEvent.type(screen.getByPlaceholderText("avaliador@email.com"), "ext@externo.org")
  getDefense.mockResolvedValue({ defense: withViewer(defenseWithMembers("SCHEDULED", [created]), "manager") })
  userEvent.click(screen.getByRole("button", { name: "Adicionar membro externo" }))

  expect(await screen.findByText("Membro adicionado. O convite com o código de acesso será enviado para ext@externo.org.")).toBeTruthy()
  expect(addExternalMember).toHaveBeenCalledWith("defense-1", {
    role: "MEMBER",
    name: "Paula Externa",
    email: "ext@externo.org",
    institution: undefined,
    acknowledgeScheduleWarning: false,
  })
  expect(await screen.findByText(/Envio do convite para ext@externo.org em processamento/)).toBeTruthy()
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(document.body.textContent).not.toMatch(TOKEN_PATTERN)
})

test("asks for confirmation before keeping a yellow-zone external member", async () => {
  resetInvitationMocks()
  const created = externalMember("ext", "Paula Externa", { email: "ext@externo.org", invitationSentAt: null })
  addExternalMember.mockRejectedValueOnce(new ApiError("Banca próxima de outra defesa.", 409, {
    code: "SCHEDULE_WARNING",
    warnings: [{ memberName: "Paula Externa", defenseId: "defense-2", scheduledDatetime: "2026-12-10T14:00:00Z", scheduledEndDatetime: "2026-12-10T16:00:00Z" }],
  }))
  addExternalMember.mockResolvedValueOnce({ member: created })
  renderCommittee(buildDefense("SCHEDULED"), "manager")

  userEvent.click(await screen.findByRole("button", { name: "Membro externo" }))
  userEvent.type(screen.getByPlaceholderText("Nome do avaliador"), "Paula Externa")
  userEvent.type(screen.getByPlaceholderText("avaliador@email.com"), "ext@externo.org")
  userEvent.click(screen.getByRole("button", { name: "Adicionar membro externo" }))

  expect(await screen.findByRole("dialog", { name: "Possível conflito de horário" })).toBeTruthy()
  expect(screen.getByText(/Paula Externa participa de outra banca/)).toBeTruthy()
  userEvent.click(screen.getByRole("button", { name: "Continuar mesmo assim" }))

  await waitFor(() => expect(addExternalMember).toHaveBeenCalledTimes(2))
  expect(addExternalMember.mock.calls[1][1]).toMatchObject({ acknowledgeScheduleWarning: true })
})

test("shows where the invitation was sent and offers Reenviar convite while it is valid", async () => {
  renderCommittee(defenseWithMembers("SCHEDULED", [externalMember("ext", "Paula Externa"), buildMember("ana", "Ana Interna")]), "manager")

  expect(await screen.findByText(/Convite enviado para ext@externo.org em 21\/11\/2026/)).toBeTruthy()
  expect(screen.getAllByRole("button", { name: "Reenviar convite" })).toHaveLength(1)
  expect(screen.queryByRole("button", { name: /Gerar novo convite/ })).toBeNull()
  expect(document.body.textContent).not.toMatch(TOKEN_PATTERN)
})

test("resends the invitation with a loading state and a success message", async () => {
  resetInvitationMocks()
  const member = externalMember("ext", "Paula Externa")
  let finishResend: (value: { member: DefenseCommitteeMember }) => void = () => undefined
  resendInvitation.mockReturnValue(new Promise((resolve) => { finishResend = resolve }))
  renderCommittee(defenseWithMembers("SCHEDULED", [member]), "manager")

  userEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }))
  const pending = await screen.findByRole("button", { name: "Reenviando…" })
  expect(pending.getAttribute("aria-describedby")).toBe("committee-member-ext")
  expect(pending).toHaveProperty("disabled", true)
  expect(resendInvitation).toHaveBeenCalledWith("defense-1", "ext")

  getDefense.mockResolvedValue({ defense: withViewer(defenseWithMembers("SCHEDULED", [{ ...member, invitationSentAt: null }]), "manager") })
  finishResend({ member: { ...member, invitationSentAt: null } })
  expect(await screen.findByText("Convite reenviado para ext@externo.org. O código anterior deixou de funcionar.")).toBeTruthy()
  expect(await screen.findByText(/Envio do convite para ext@externo.org em processamento/)).toBeTruthy()
  expect(screen.getByRole("button", { name: "Reenviar convite" })).toHaveProperty("disabled", false)
})

test.each([
  [new ApiError("Convite já utilizado não pode ser reenviado. Gere um novo convite.", 400), "Convite já utilizado não pode ser reenviado. Gere um novo convite."],
  [new ApiError("Forbidden", 403), "Você não tem permissão para esta ação."],
  [new ApiError("Throttled", 429), "Muitas solicitações de convite em sequência. Aguarde um minuto e tente novamente."],
])("shows a Portuguese error when the resend fails (%s)", async (failure, message) => {
  resetInvitationMocks()
  resendInvitation.mockRejectedValue(failure)
  renderCommittee(defenseWithMembers("SCHEDULED", [externalMember("ext", "Paula Externa")]), "manager")

  userEvent.click(await screen.findByRole("button", { name: "Reenviar convite" }))
  expect(await screen.findByText(message)).toBeTruthy()
  expect(screen.getByText(message).getAttribute("role")).toBe("alert")
  expect(screen.getByRole("button", { name: "Reenviar convite" })).toHaveProperty("disabled", false)
})

test.each([
  ["USED" as const, "Convite já utilizado por ext@externo.org. Para um novo acesso, gere um novo convite."],
  ["EXPIRED" as const, "Convite para ext@externo.org expirado. Gere um novo convite."],
])("offers Gerar novo convite instead of resend for a %s invitation", async (invitationStatus, text) => {
  resetInvitationMocks()
  const member = externalMember("ext", "Paula Externa", { invitationStatus, canResendInvitation: false })
  regenerateInvitation.mockResolvedValue({ member: { ...member, invitationStatus: "PENDING", invitationSentAt: null, canResendInvitation: true } })
  renderCommittee(defenseWithMembers("IN_PROGRESS", [member, buildMember("ana", "Ana Interna")]), "manager")

  expect(await screen.findByText(text)).toBeTruthy()
  expect(screen.queryByRole("button", { name: /Reenviar convite/ })).toBeNull()
  userEvent.click(screen.getByRole("button", { name: "Gerar novo convite" }))
  const confirm = screen.getByRole("dialog")
  expect(confirm.textContent).toContain("Um novo código de acesso será enviado para ext@externo.org")
  expect(confirm.textContent).toContain("A disponibilidade e a avaliação já registradas são mantidas.")
  expect(regenerateInvitation).not.toHaveBeenCalled()
  userEvent.click(within(confirm).getByRole("button", { name: "Gerar novo convite" }))

  await waitFor(() => expect(regenerateInvitation).toHaveBeenCalledWith("defense-1", "ext"))
  expect(await screen.findByText("Novo convite enviado para ext@externo.org. O código anterior deixou de funcionar.")).toBeTruthy()
  expect(document.body.textContent).not.toMatch(TOKEN_PATTERN)
})

test("keeps the confirmation open with the error when a new invitation is refused", async () => {
  resetInvitationMocks()
  regenerateInvitation.mockRejectedValue(new ApiError("Throttled", 429))
  renderCommittee(defenseWithMembers("SCHEDULED", [externalMember("ext", "Paula Externa", { invitationStatus: "USED", canResendInvitation: false })]), "manager")

  userEvent.click(await screen.findByRole("button", { name: "Gerar novo convite" }))
  userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Gerar novo convite" }))
  const dialog = await screen.findByRole("dialog")
  expect(await within(dialog).findByText("Muitas solicitações de convite em sequência. Aguarde um minuto e tente novamente.")).toBeTruthy()
})

test("hides invitation status and actions without management permission", async () => {
  renderCommittee(defenseWithMembers("SCHEDULED", [externalMember("ext", "Paula Externa", { invitationStatus: null, invitationSentAt: null, canResendInvitation: false })]))
  await screen.findByText("Paula Externa")
  expect(screen.queryByText(/Convite enviado para/)).toBeNull()
  expect(screen.queryByRole("button", { name: /Reenviar convite/ })).toBeNull()
  expect(screen.queryByRole("button", { name: /Gerar novo convite/ })).toBeNull()
})

test("hides invitation actions on a completed defense", async () => {
  renderCommittee(defenseWithMembers("COMPLETED", [externalMember("ext", "Paula Externa", { canResendInvitation: false })]), "manager")
  await screen.findByText("Paula Externa")
  expect(screen.queryByRole("button", { name: /Reenviar convite/ })).toBeNull()
  expect(screen.queryByRole("button", { name: /Gerar novo convite/ })).toBeNull()
})

test("edit modal keeps an older remote location editable and validates a changed link", async () => {
  renderCommittee({ ...buildDefense("SCHEDULED"), modality: "REMOTE", modalityLabel: "Remota", location: "Sala virtual" }, "manager")
  userEvent.click(await screen.findByRole("button", { name: "Editar agendamento" }))
  const dialog = screen.getByRole("dialog")
  const save = within(dialog).getByRole("button", { name: "Salvar alterações" })

  userEvent.type(within(dialog).getByLabelText(/Observações/), "Levar projetor")
  expect(within(dialog).queryByRole("alert")).toBeNull()
  expect(save).toHaveProperty("disabled", false)

  const link = within(dialog).getByLabelText("Link da defesa")
  userEvent.clear(link)
  userEvent.type(link, "sala2")
  expect(within(dialog).getByRole("alert").textContent).toContain("informe o link da reunião")
  expect(save).toHaveProperty("disabled", true)

  userEvent.clear(link)
  userEvent.type(link, "https://meet.google.com/nova")
  expect(save).toHaveProperty("disabled", false)
})

function asViewer(defense: DefenseData, memberId: string | null): DefenseData {
  return {
    ...defense,
    viewerMembership: { isMember: memberId !== null, memberId, role: null, roleLabel: null, canEvaluate: false, hasEvaluated: false },
  }
}

test("pending signed-in member sees the reminder with both answers", async () => {
  const me = buildMember("me", "Eu Mesmo")
  getDefense.mockResolvedValue({ defense: asViewer(defenseWithMembers("SCHEDULED", [me]), "me") })
  render(<DefenseCommittee defenseId="defense-1" goBack={() => undefined} />)

  expect(await screen.findByText("Você ainda não confirmou sua disponibilidade para esta banca.")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Confirmar disponibilidade" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Informar indisponibilidade" })).toBeTruthy()
})

test.each([
  ["CONFIRMED" as const, "Confirmado", "Informar indisponibilidade", "Confirmar disponibilidade"],
  ["DECLINED" as const, "Indisponível", "Confirmar disponibilidade", "Informar indisponibilidade"],
])("member who answered %s sees only the own badge and the option to change", async (status, label, change, hidden) => {
  const me = buildMember("me", "Eu Mesmo", { availabilityStatus: status })
  getDefense.mockResolvedValue({ defense: asViewer(defenseWithMembers("SCHEDULED", [me]), "me") })
  render(<DefenseCommittee defenseId="defense-1" goBack={() => undefined} />)

  expect(await screen.findByRole("button", { name: change })).toBeTruthy()
  expect(screen.queryByRole("button", { name: hidden })).toBeNull()
  expect(screen.queryByText("Você ainda não confirmou sua disponibilidade para esta banca.")).toBeNull()
  // Selo na resposta e na linha do próprio membro na comissão.
  expect(screen.getAllByText(label)).toHaveLength(2)
})

test("member who does not manage the defense sees only the own availability", async () => {
  const me = buildMember("me", "Eu Mesmo", { availabilityStatus: "CONFIRMED" })
  const others = [
    buildMember("ana", "Ana Pendente"),
    buildMember("carla", "Carla Indisponível", { availabilityStatus: "DECLINED", availabilityNote: "Viagem" }),
  ]
  getDefense.mockResolvedValue({ defense: asViewer(defenseWithMembers("SCHEDULED", [me, ...others]), "me") })
  render(<DefenseCommittee defenseId="defense-1" goBack={() => undefined} />)

  expect(await screen.findByText("Carla Indisponível")).toBeTruthy()
  expect(screen.queryByText(/Aguardando confirmação de:/)).toBeNull()
  expect(screen.queryByText("Aguardando confirmação")).toBeNull()
  expect(screen.queryByText("Indisponível")).toBeNull()
  expect(screen.queryByText("Observação: Viagem")).toBeNull()
  expect(screen.getAllByText("Confirmado")).toHaveLength(2)
})

test("thesis advisor responsible for the defense sees the pending summary and every badge", async () => {
  renderCommittee(asViewer(defenseWithMembers("SCHEDULED", [buildMember("ana", "Ana Pendente")]), null), "manager")

  expect(await screen.findByText("Aguardando confirmação de: Ana Pendente")).toBeTruthy()
  expect(screen.getByText("Aguardando confirmação")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Iniciar banca" })).toHaveProperty("disabled", true)
})

const closeDefense = jest.spyOn(defenseApi, "close")

const ALL_ACTIONS = [
  "Iniciar banca",
  "Encerrar banca",
  "Cancelar banca",
  "Reverter status",
  "Editar agendamento",
  "Membro institucional",
  "Membro externo",
  "Reenviar convite",
  "Gerar novo convite",
  "Remover",
]

function visibleActions(): string[] {
  return ALL_ACTIONS.filter((name) => screen.queryByRole("button", { name }) !== null)
}

/** Payload as the backend sends it to a viewer without canManage: other members' availability is null. */
function hiddenAvailability(member: DefenseCommitteeMember): DefenseCommitteeMember {
  return { ...member, availabilityStatus: null, availabilityStatusLabel: null, availabilityRespondedAt: null, availabilityNote: null }
}

test("coordinator of another course who is a member sees no actions and no other member badges", async () => {
  const me = buildMember("me", "Eu Coordenador", { availabilityStatus: "CONFIRMED" })
  const others = [
    hiddenAvailability(buildMember("ana", "Ana Pendente")),
    hiddenAvailability(externalMember("ext", "Paula Externa")),
  ]
  const defense: DefenseData = {
    ...asViewer(buildDefense("SCHEDULED"), "me"),
    members: [me, ...others],
    allMembersConfirmed: false,
    pendingConfirmations: null,
  }
  renderCommittee(defense, "none")

  expect(await screen.findByText("Paula Externa")).toBeTruthy()
  expect(visibleActions()).toEqual([])
  expect(screen.queryByText(/Aguardando confirmação/)).toBeNull()
  // Só o próprio selo: na resposta de disponibilidade e na linha do membro.
  expect(screen.getAllByText("Confirmado")).toHaveLength(2)
  expect(screen.getByRole("button", { name: "Informar indisponibilidade" })).toBeTruthy()
})

test.each([
  ["canEdit", ["Editar agendamento"]],
  ["canCancel", ["Cancelar banca"]],
  ["canStart", ["Iniciar banca"]],
  ["canClose", ["Encerrar banca"]],
  ["canRevert", ["Reverter status"]],
  ["canManageMembers", ["Membro institucional", "Membro externo", "Reenviar convite", "Remover"]],
] as const)("only %s shows %j", async (flag, expected) => {
  const defense: DefenseData = {
    ...defenseWithMembers("SCHEDULED", [externalMember("ext", "Paula Externa")]),
    viewerPermissions: { ...defensePermissions("none", "SCHEDULED"), [flag]: true },
  }
  getDefense.mockResolvedValue({ defense })
  render(<DefenseCommittee defenseId="defense-1" goBack={() => undefined} />)

  await screen.findByText("Paula Externa")
  expect(visibleActions()).toEqual(expected)
})

test("adds members on a defense in progress but does not offer removal", async () => {
  renderCommittee(defenseWithMembers("IN_PROGRESS", [externalMember("ext", "Paula Externa")]), "manager")
  await screen.findByText("Paula Externa")
  expect(visibleActions()).toEqual(["Encerrar banca", "Membro institucional", "Membro externo", "Reenviar convite"])
})

test("shows Iniciar banca disabled with an explanation when canStart is true but nobody can confirm yet", async () => {
  renderCommittee({ ...buildDefense("SCHEDULED"), allMembersConfirmed: false, pendingConfirmations: [] }, "manager")
  const start = await screen.findByRole("button", { name: "Iniciar banca" })
  expect(start).toHaveProperty("disabled", true)
  const describedBy = start.getAttribute("aria-describedby")
  const explanation = screen.getAllByRole("status").find((element) => element.id === describedBy)
  expect(explanation?.textContent).toContain("Aguardando a confirmação dos membros titulares")
})

test("does not show the pending summary when pendingConfirmations is null", async () => {
  const defense: DefenseData = {
    ...defenseWithMembers("SCHEDULED", [buildMember("ana", "Ana Pendente")]),
    pendingConfirmations: null,
  }
  renderCommittee(defense, "manager")
  const start = await screen.findByRole("button", { name: "Iniciar banca" })
  expect(start).toHaveProperty("disabled", true)
  expect(screen.queryByText(/Aguardando confirmação de:/)).toBeNull()
})

test("shows the backend message when closing is refused for missing evaluations", async () => {
  closeDefense.mockReset()
  closeDefense.mockRejectedValue(
    new ApiError("Todos os membros não-suplentes precisam ter avaliado antes do encerramento.", 400),
  )
  renderCommittee(defenseWithMembers("IN_PROGRESS", [buildMember("ana", "Ana Interna")]), "manager")
  userEvent.click(await screen.findByRole("button", { name: "Encerrar banca" }))
  const dialog = screen.getByRole("dialog")
  userEvent.click(within(dialog).getByRole("button", { name: "Encerrar banca" }))

  await waitFor(() => expect(closeDefense).toHaveBeenCalledWith("defense-1"))
  expect((await within(dialog).findByRole("alert")).textContent).toContain(
    "Todos os membros não-suplentes precisam ter avaliado antes do encerramento.",
  )
})

test("shows the institutional member photo and keeps initials for external members", async () => {
  renderCommittee(
    defenseWithMembers("SCHEDULED", [
      buildMember("ana", "Ana Souza", { avatarUrl: "https://lh3.googleusercontent.com/ana" }),
      externalMember("ext", "Paula Externa"),
    ]),
    "manager",
  )
  await screen.findByText("Ana Souza")
  const photos = screen.getAllByRole("presentation", { hidden: true })
  expect(photos).toHaveLength(1)
  expect(photos[0]?.getAttribute("src")).toBe("https://lh3.googleusercontent.com/ana")
  expect(screen.getByText("PE")).toBeTruthy()
})
