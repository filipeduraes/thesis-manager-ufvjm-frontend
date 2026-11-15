/** Defense status codes returned by the backend (`DefenseStatus`). */
export type DefenseStatusCode = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"

type DefenseStatusTone = "light" | "active" | "success" | "dark" | "neutral"

/** Portuguese labels for the status filter; the list itself shows `statusLabel` from the API. */
export const DEFENSE_STATUS_OPTIONS: ReadonlyArray<{ value: DefenseStatusCode; label: string }> = [
  { value: "SCHEDULED", label: "Agendada" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "COMPLETED", label: "Concluída" },
  { value: "CANCELLED", label: "Cancelada" },
]

const DEFENSE_STATUS_TONES: Record<DefenseStatusCode, DefenseStatusTone> = {
  SCHEDULED: "light",
  IN_PROGRESS: "active",
  COMPLETED: "success",
  CANCELLED: "dark",
}

/** Returns the `Badge` tone for a defense status code; unknown codes are neutral. */
export function defenseStatusTone(status: string): DefenseStatusTone {
  const match = DEFENSE_STATUS_OPTIONS.find((option) => option.value === status)
  return match ? DEFENSE_STATUS_TONES[match.value] : "neutral"
}
