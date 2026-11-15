import type { BadgeTone } from "./thesisStatus"

/** Defense status codes returned by the backend (`DefenseStatus`). */
export type DefenseStatusCode = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"

/** Portuguese labels for the status filter; the list itself shows `statusLabel` from the API. */
export const DEFENSE_STATUS_OPTIONS: ReadonlyArray<{ value: DefenseStatusCode; label: string }> = [
  { value: "SCHEDULED", label: "Agendada" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "COMPLETED", label: "Concluída" },
  { value: "CANCELLED", label: "Cancelada" },
]

// Mesmos tons de thesisStatusTones: "Banca agendada" e "Em avaliação pela banca" são
// active, aprovação é success e resultados negativos são dark (Badge não tem tom de perigo).
const DEFENSE_STATUS_TONES: Record<DefenseStatusCode, BadgeTone> = {
  SCHEDULED: "active",
  IN_PROGRESS: "active",
  COMPLETED: "success",
  CANCELLED: "dark",
}

// Mesma lógica de reviewDecisionTones e thesisStatusTones para o parecer de cada membro.
const DEFENSE_DECISION_TONES: Record<string, BadgeTone> = {
  APPROVED: "success",
  APPROVED_WITH_REMARKS: "success",
  REJECTED: "dark",
}

/** Returns the `Badge` tone for a defense status code; unknown codes are neutral. */
export function defenseStatusTone(status: string): BadgeTone {
  const match = DEFENSE_STATUS_OPTIONS.find((option) => option.value === status)
  return match ? DEFENSE_STATUS_TONES[match.value] : "neutral"
}

/** Returns the `Badge` tone for a committee member's decision; unknown codes are neutral. */
export function defenseDecisionTone(decision: string): BadgeTone {
  return DEFENSE_DECISION_TONES[decision] ?? "neutral"
}
