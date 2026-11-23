import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  defenseApi,
  thesesApi,
  type DefenseCommitteeMember,
  type DefenseData,
  type DefenseMemberEvaluationData,
} from "../api/client"
import DefenseEvaluation from "./DefenseEvaluation"
import { defensePermissions } from "./defense/defensePermissionsFixture"

const getDefense = jest.spyOn(defenseApi, "get")
const submitEvaluation = jest.spyOn(defenseApi, "submitEvaluation")
const getThesis = jest.spyOn(thesesApi, "detail")

const STATUS_LABELS: Record<string, string> = { IN_PROGRESS: "Em andamento", COMPLETED: "Concluída" }

const SAVED_EVALUATION: DefenseMemberEvaluationData = {
  id: "evaluation-1",
  decision: "APPROVED",
  decisionLabel: "Aprovada",
  submittedAt: "2026-11-20T18:00:00Z",
  score: "9.00",
  notes: "",
  updatedAt: "2026-11-20T18:00:00Z",
}

function member(evaluation: DefenseMemberEvaluationData | null = null): DefenseCommitteeMember {
  return {
    id: "member-1",
    role: "MEMBER",
    roleLabel: "Membro",
    name: "Prof. Avaliador",
    email: "avaliador@ufvjm.edu.br",
    institution: "",
    hasConflict: false,
    conflictReason: "",
    isInstitutional: true,
    avatarUrl: null,
    availabilityStatus: "CONFIRMED",
    availabilityStatusLabel: "Confirmada",
    availabilityRespondedAt: "2026-11-18T12:00:00Z",
    availabilityNote: "",
    createdAt: "2026-11-01T12:00:00Z",
    evaluation,
  }
}

function buildDefense(status: string, evaluation: DefenseMemberEvaluationData | null = null): DefenseData {
  return {
    id: "defense-1",
    thesis: "thesis-1",
    scheduledDatetime: "2026-11-20T17:00:00Z",
    durationMinutes: 120,
    modality: "IN_PERSON",
    modalityLabel: "Presencial",
    location: "Sala 10",
    notes: "",
    status,
    statusLabel: STATUS_LABELS[status] ?? status,
    createdAt: "2026-11-01T12:00:00Z",
    updatedAt: "2026-11-01T12:00:00Z",
    members: [member(evaluation)],
    viewerMembership: {
      isMember: true, memberId: "member-1", role: "MEMBER", roleLabel: "Membro",
      canEvaluate: true, hasEvaluated: Boolean(evaluation),
    },
  }
}

function completedWithResult(): DefenseData {
  return { ...buildDefense("COMPLETED", SAVED_EVALUATION), result: "APPROVED", resultLabel: "Aprovada" }
}

async function typeNotes() {
  const score = await screen.findByPlaceholderText<HTMLInputElement>("Ex.: 8.50")
  if (!score.value) userEvent.type(score, "8.50")
  const textarea = await screen.findByPlaceholderText("Comentários para o aluno e para a comissão")
  userEvent.type(textarea, "Parecer de teste.")
}

function renderEvaluation() {
  render(<DefenseEvaluation defenseId="defense-1" goBack={() => undefined} />)
}

beforeEach(() => {
  getDefense.mockReset()
  submitEvaluation.mockReset()
  getThesis.mockReset()
})

afterAll(() => {
  jest.restoreAllMocks()
})

test("institutional member still submits the evaluation with decision and score", async () => {
  getDefense.mockResolvedValueOnce({ defense: buildDefense("IN_PROGRESS") })
  getDefense.mockResolvedValue({ defense: buildDefense("IN_PROGRESS", SAVED_EVALUATION) })
  submitEvaluation.mockResolvedValue({
    evaluation: SAVED_EVALUATION,
    resultCalculationQueued: true,
    defenseStatus: "IN_PROGRESS",
    defenseStatusLabel: "Em andamento",
  })
  renderEvaluation()

  userEvent.type(await screen.findByPlaceholderText("Ex.: 8.50"), "9")
  await typeNotes()
  userEvent.click(screen.getByRole("button", { name: "Registrar avaliação" }))
  await waitFor(() =>
    expect(submitEvaluation).toHaveBeenCalledWith("defense-1", "member-1", { decision: "APPROVED", notes: "Parecer de teste.", score: "9.00" }),
  )
  expect(await screen.findByText("Avaliação enviada")).toBeTruthy()
  expect(screen.queryByText(/Banca encerrada/)).toBeNull()
})

test.each(["institutional", "external"] as const)("loads and updates only the signed-in %s member's saved evaluation", async (variant) => {
  const saved = { ...SAVED_EVALUATION, notes: "Parecer original" }
  const ownDefense = buildDefense("IN_PROGRESS", saved)
  const updated = { ...saved, decision: "REJECTED", decisionLabel: "Reprovada", score: "8.50", notes: "Parecer revisado" }
  getDefense.mockResolvedValueOnce({
    defense: {
      ...ownDefense,
      members: [{ ...member(), id: "another-member", evaluation: updated }, ...ownDefense.members],
    },
  })
  getDefense.mockResolvedValue({ defense: buildDefense("IN_PROGRESS", updated) })
  submitEvaluation.mockResolvedValue({
    evaluation: updated, resultCalculationQueued: true, defenseStatus: "IN_PROGRESS", defenseStatusLabel: "Em andamento",
  })
  render(<DefenseEvaluation defenseId="defense-1" memberId={variant === "external" ? "member-1" : undefined} variant={variant} />)

  const save = await screen.findByRole("button", { name: "Atualizar avaliação" })
  const score = screen.getByRole<HTMLInputElement>("spinbutton")
  expect(score.value).toBe("9.00")
  expect(screen.getByDisplayValue("Parecer original")).toBeTruthy()
  expect(screen.getByRole<HTMLInputElement>("radio", { name: /Aprovada Apta/ }).checked).toBe(true)
  userEvent.clear(score)
  userEvent.type(score, "8.50")
  userEvent.clear(screen.getByDisplayValue("Parecer original"))
  userEvent.type(screen.getByRole("textbox"), "Parecer revisado")
  userEvent.click(screen.getByRole("radio", { name: /Reprovada/ }))
  userEvent.click(save)

  await waitFor(() => expect(submitEvaluation).toHaveBeenCalledWith("defense-1", "member-1", {
    decision: "REJECTED", score: "8.50", notes: "Parecer revisado",
  }))
  expect(await screen.findByDisplayValue("Parecer revisado")).toBeTruthy()
})

test("blocks an external assignment that conflicts with the authenticated membership", async () => {
  const defense = buildDefense("IN_PROGRESS", SAVED_EVALUATION)
  defense.members.push({ ...member(), id: "another-member" })
  getDefense.mockResolvedValue({ defense })
  render(<DefenseEvaluation defenseId="defense-1" memberId="another-member" variant="external" />)

  expect(await screen.findByText("Você não está registrado como membro desta banca.")).toBeTruthy()
  expect(screen.queryByRole("button", { name: /avaliação$/ })).toBeNull()
  expect(submitEvaluation).not.toHaveBeenCalled()
})

test("keeps the refresh button inside the summary actions instead of the icon column", async () => {
  getDefense.mockResolvedValue({ defense: buildDefense("IN_PROGRESS") })
  renderEvaluation()

  const refreshButton = await screen.findByRole("button", { name: "Atualizar" })
  // O defeito era de layout: sem o contêiner .defense-actions o botão caía na coluna de 42px do ícone.
  // eslint-disable-next-line testing-library/no-node-access
  const actions = refreshButton.closest(".defense-actions")
  expect(actions).not.toBeNull()
  expect(actions?.textContent).toContain("Em andamento")
  expect(actions?.textContent).toContain("Membro")
})

test("reloads after the last evaluation and shows the result of the automatic close", async () => {
  getDefense.mockResolvedValueOnce({ defense: buildDefense("IN_PROGRESS") })
  getDefense.mockResolvedValue({ defense: completedWithResult() })
  submitEvaluation.mockResolvedValue({
    evaluation: SAVED_EVALUATION,
    resultCalculationQueued: true,
    defenseStatus: "COMPLETED",
    defenseStatusLabel: "Concluída",
  })
  renderEvaluation()

  await typeNotes()
  userEvent.click(await screen.findByRole("button", { name: "Registrar avaliação" }))
  expect(await screen.findByText("Banca encerrada. Resultado: Aprovada")).toBeTruthy()
  expect(getDefense).toHaveBeenCalledTimes(2)
  expect(getThesis).not.toHaveBeenCalled()
  expect(screen.queryByRole("button", { name: /avaliação$/ })).toBeNull()
  // fieldset disabled não altera a propriedade disabled do input no jsdom, só :disabled.
  expect(screen.getByRole("radio", { name: /Reprovada/ }).matches(":disabled")).toBe(true)
  expect(screen.getByText("Banca encerrada: a avaliação está bloqueada.")).toBeTruthy()
})

test("keeps the evaluation as saved when the automatic close fails", async () => {
  getDefense.mockResolvedValueOnce({ defense: buildDefense("IN_PROGRESS") })
  getDefense.mockResolvedValue({ defense: buildDefense("IN_PROGRESS", SAVED_EVALUATION) })
  submitEvaluation.mockResolvedValue({
    evaluation: SAVED_EVALUATION,
    resultCalculationQueued: false,
    defenseStatus: "IN_PROGRESS",
    defenseStatusLabel: "Em andamento",
  })
  renderEvaluation()

  await typeNotes()
  userEvent.click(await screen.findByRole("button", { name: "Registrar avaliação" }))
  expect(
    await screen.findByText(
      "Avaliação salva, mas a apuração do resultado não foi agendada. Tente novamente.",
    ),
  ).toBeTruthy()
  expect(screen.getByText("Avaliação enviada")).toBeTruthy()
  expect(screen.queryByRole("alert")).toBeNull()
  expect(await screen.findByRole("button", { name: "Atualizar avaliação" })).toBeTruthy()
})

test("tells a viewer with canClose that the defense can be closed manually", async () => {
  const inProgress: DefenseData = {
    ...buildDefense("IN_PROGRESS"),
    viewerPermissions: defensePermissions("manager", "IN_PROGRESS"),
  }
  getDefense.mockResolvedValueOnce({ defense: inProgress })
  getDefense.mockResolvedValue({ defense: { ...inProgress, members: [member(SAVED_EVALUATION)] } })
  submitEvaluation.mockResolvedValue({
    evaluation: SAVED_EVALUATION,
    resultCalculationQueued: false,
    defenseStatus: "IN_PROGRESS",
    defenseStatusLabel: "Em andamento",
  })
  renderEvaluation()

  await typeNotes()
  userEvent.click(await screen.findByRole("button", { name: "Registrar avaliação" }))
  expect(await screen.findByText("Você pode encerrar a banca manualmente em Gerenciar banca.")).toBeTruthy()
})

test("locks a completed defense and omits the result while the backend has none", async () => {
  getDefense.mockResolvedValue({ defense: { ...buildDefense("COMPLETED", SAVED_EVALUATION), result: null, resultLabel: null } })
  renderEvaluation()

  expect(await screen.findByText("Banca encerrada.")).toBeTruthy()
  await waitFor(() => expect(getThesis).not.toHaveBeenCalled())
  expect(screen.queryByText(/Resultado:/)).toBeNull()
  expect(screen.queryByRole("button", { name: /avaliação$/ })).toBeNull()
  expect(screen.queryByText("Avaliação disponível quando a banca estiver em andamento")).toBeNull()
})

test("external evaluator does not query the thesis for the result", async () => {
  getDefense.mockResolvedValue({ defense: buildDefense("COMPLETED", SAVED_EVALUATION) })
  render(<DefenseEvaluation defenseId="defense-1" memberId="member-1" variant="external" />)

  expect(await screen.findByText("Banca encerrada.")).toBeTruthy()
  expect(getThesis).not.toHaveBeenCalled()
})

test("committee examiner sees the result recorded in the defense detail", async () => {
  getDefense.mockResolvedValue({ defense: completedWithResult() })
  renderEvaluation()

  expect(await screen.findByText("Banca encerrada. Resultado: Aprovada")).toBeTruthy()
  expect(getThesis).not.toHaveBeenCalled()
})

test("external evaluator sees the result recorded in the defense detail", async () => {
  getDefense.mockResolvedValue({ defense: { ...completedWithResult(), result: "APPROVED_WITH_REMARKS", resultLabel: "Aprovada com ressalvas" } })
  render(<DefenseEvaluation defenseId="defense-1" memberId="member-1" variant="external" />)

  expect(await screen.findByText("Banca encerrada. Resultado: Aprovada com ressalvas")).toBeTruthy()
  expect(getThesis).not.toHaveBeenCalled()
})
