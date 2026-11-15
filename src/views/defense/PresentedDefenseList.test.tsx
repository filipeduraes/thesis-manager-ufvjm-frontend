import { expect, test } from "@jest/globals"
import { render, screen } from "@testing-library/react"
import type { DefenseListItem, DefenseViewerMembership } from "../../api/client"
import PresentedDefenseList from "./PresentedDefenseList"

function buildDefense(id: string, title: string, membership: Partial<DefenseViewerMembership>): DefenseListItem {
  return {
    id,
    thesis: `thesis-${id}`,
    scheduledDatetime: "2026-11-20T17:00:00Z",
    durationMinutes: 120,
    modality: "IN_PERSON",
    modalityLabel: "Presencial",
    location: "",
    notes: "",
    status: "SCHEDULED",
    statusLabel: "Agendada",
    createdAt: "2026-11-01T12:00:00Z",
    updatedAt: "2026-11-01T12:00:00Z",
    members: [],
    thesisTitle: title,
    thesisReferenceCode: `REF-${id}`,
    student: null,
    advisor: null,
    viewerMembership: {
      isMember: false,
      memberId: null,
      role: null,
      roleLabel: null,
      canEvaluate: false,
      hasEvaluated: false,
      ...membership,
    },
  }
}

const noop = () => undefined

test("shows evaluation actions according to viewerMembership", () => {
  const defenses = [
    buildDefense("a", "Banca pendente", { isMember: true, canEvaluate: true, hasEvaluated: false }),
    buildDefense("b", "Banca avaliada", { isMember: true, canEvaluate: true, hasEvaluated: true }),
    buildDefense("c", "Banca sem participação", {}),
  ]
  render(
    <PresentedDefenseList
      listState={{ status: "ready", defenses, count: defenses.length }}
      onRetry={noop}
      onEvaluate={noop}
      onOpenCommittee={noop}
    />,
  )

  const evaluateButtons = screen.getAllByRole("button", { name: "Avaliar" })
  expect(evaluateButtons).toHaveLength(1)
  expect(evaluateButtons[0]).toHaveProperty("disabled", false)

  const sentButtons = screen.getAllByRole("button", { name: "Parecer enviado" })
  expect(sentButtons).toHaveLength(1)
  expect(sentButtons[0]).toHaveProperty("disabled", true)

  expect(screen.getAllByRole("button", { name: "Membros" })).toHaveLength(3)
})

test("shows the empty state when the backend returns no defenses", () => {
  render(
    <PresentedDefenseList
      listState={{ status: "ready", defenses: [], count: 0 }}
      onRetry={noop}
      onEvaluate={noop}
      onOpenCommittee={noop}
    />,
  )
  expect(screen.getByText("Nenhuma banca encontrada")).toBeTruthy()
})

test("shows the backend error message with a retry action", () => {
  render(
    <PresentedDefenseList
      listState={{ status: "error", message: "Você não tem permissão para consultar bancas." }}
      onRetry={noop}
      onEvaluate={noop}
      onOpenCommittee={noop}
    />,
  )
  expect(screen.getByRole("alert").textContent).toContain("Você não tem permissão para consultar bancas.")
  expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy()
})

test("shows the scheduled time in São Paulo", () => {
  const defenses = [buildDefense("a", "Banca das 17h", {})]
  render(
    <PresentedDefenseList
      listState={{ status: "ready", defenses, count: 1 }}
      onRetry={noop}
      onEvaluate={noop}
      onOpenCommittee={noop}
    />,
  )
  // buildDefense agenda para 2026-11-20T17:00:00Z, ou seja, 14:00 em São Paulo.
  expect(screen.getByText(/20 de nov\.? de 2026.*14:00/)).toBeTruthy()
})
