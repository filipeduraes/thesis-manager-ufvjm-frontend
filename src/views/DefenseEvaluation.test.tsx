import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  ApiError,
  defenseApi,
  thesesApi,
  type DefenseCommitteeMember,
  type DefenseData,
  type DefenseMemberEvaluationData,
  type Thesis,
} from "../api/client"
import DefenseEvaluation from "./DefenseEvaluation"

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
  }
}

function thesisWithStatus(status: Thesis["status"]): { thesis: Thesis } {
  // Somente o status final da tese importa para o resultado exibido.
  const partial: Pick<Thesis, "status"> = { status }
  return { thesis: partial as Thesis }
}

function renderEvaluation() {
  render(<DefenseEvaluation defenseId="defense-1" userEmail="Avaliador@ufvjm.edu.br" goBack={() => undefined} />)
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
  getDefense.mockResolvedValue({ defense: buildDefense("IN_PROGRESS") })
  submitEvaluation.mockResolvedValue({
    evaluation: SAVED_EVALUATION,
    autoCloseError: null,
    defenseStatus: "IN_PROGRESS",
    defenseStatusLabel: "Em andamento",
  })
  renderEvaluation()

  userEvent.type(await screen.findByPlaceholderText("Ex.: 8.50"), "9")
  userEvent.click(screen.getByRole("button", { name: "Registrar avaliação" }))
  await waitFor(() =>
    expect(submitEvaluation).toHaveBeenCalledWith("defense-1", "member-1", { decision: "APPROVED", notes: undefined, score: "9.00" }),
  )
  expect(await screen.findByText("Avaliação enviada")).toBeTruthy()
  expect(screen.queryByText(/Banca encerrada/)).toBeNull()
})

test("reloads after the last evaluation and shows the result of the automatic close", async () => {
  getDefense.mockResolvedValueOnce({ defense: buildDefense("IN_PROGRESS") })
  getDefense.mockResolvedValue({ defense: buildDefense("COMPLETED", SAVED_EVALUATION) })
  getThesis.mockResolvedValue(thesisWithStatus("APPROVED"))
  submitEvaluation.mockResolvedValue({
    evaluation: SAVED_EVALUATION,
    autoCloseError: null,
    defenseStatus: "COMPLETED",
    defenseStatusLabel: "Concluída",
  })
  renderEvaluation()

  userEvent.click(await screen.findByRole("button", { name: "Registrar avaliação" }))
  expect(await screen.findByText("Banca encerrada. Resultado: Aprovada")).toBeTruthy()
  expect(getDefense).toHaveBeenCalledTimes(2)
  expect(getThesis).toHaveBeenCalledWith("thesis-1")
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
    autoCloseError: "A monografia não possui PDF atual.",
    defenseStatus: "IN_PROGRESS",
    defenseStatusLabel: "Em andamento",
  })
  renderEvaluation()

  userEvent.click(await screen.findByRole("button", { name: "Registrar avaliação" }))
  expect(
    await screen.findByText(
      "Avaliação salva. A banca não pôde ser encerrada automaticamente: A monografia não possui PDF atual.",
    ),
  ).toBeTruthy()
  expect(screen.getByText("Avaliação enviada")).toBeTruthy()
  expect(screen.queryByRole("alert")).toBeNull()
  expect(await screen.findByRole("button", { name: "Atualizar avaliação" })).toBeTruthy()
})

test("locks a completed defense and omits the result the user cannot read", async () => {
  getDefense.mockResolvedValue({ defense: buildDefense("COMPLETED", SAVED_EVALUATION) })
  getThesis.mockRejectedValue(new ApiError("Monografia não encontrada.", 404))
  renderEvaluation()

  expect(await screen.findByText("Banca encerrada.")).toBeTruthy()
  await waitFor(() => expect(getThesis).toHaveBeenCalledWith("thesis-1"))
  expect(screen.queryByText(/Resultado:/)).toBeNull()
  expect(screen.queryByRole("button", { name: /avaliação$/ })).toBeNull()
  expect(screen.queryByText("Avaliação disponível quando a banca estiver em andamento")).toBeNull()
})

test("external evaluator does not query the thesis for the result", async () => {
  getDefense.mockResolvedValue({ defense: buildDefense("COMPLETED", SAVED_EVALUATION) })
  render(<DefenseEvaluation defenseId="defense-1" userEmail="x@externo.org" memberId="member-1" variant="external" />)

  expect(await screen.findByText("Banca encerrada.")).toBeTruthy()
  expect(getThesis).not.toHaveBeenCalled()
})
