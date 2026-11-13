import type {
  ThesisDefenseResult,
  ThesisDocumentStatus,
  ThesisDocumentType,
  ThesisReviewDecision,
  ThesisStatus,
} from "../api/client"

export type BadgeTone = "neutral" | "active" | "success" | "dark" | "light"

export const thesisStatusLabels: Record<ThesisStatus, string> = {
  DRAFT: "Rascunho",
  SUBMITTED: "Submetida",
  ADVISOR_REVIEW: "Em revisão do orientador",
  CHANGES_REQUESTED: "Ajustes solicitados",
  ADVISOR_APPROVED: "Aprovada pelo orientador",
  READY_FOR_DEFENSE: "Pronta para banca",
  DEFENSE_SCHEDULED: "Banca agendada",
  UNDER_EVALUATION: "Em avaliação pela banca",
  APPROVED: "Aprovada",
  APPROVED_WITH_REMARKS: "Aprovada com ressalvas",
  REJECTED: "Reprovada",
  CORRECTIONS_PENDING: "Correções pendentes",
  PUBLISHED: "Publicada",
  ARCHIVED: "Arquivada",
}

export const thesisStatusTones: Record<ThesisStatus, BadgeTone> = {
  DRAFT: "neutral",
  SUBMITTED: "active",
  ADVISOR_REVIEW: "active",
  CHANGES_REQUESTED: "light",
  ADVISOR_APPROVED: "success",
  READY_FOR_DEFENSE: "success",
  DEFENSE_SCHEDULED: "active",
  UNDER_EVALUATION: "active",
  APPROVED: "success",
  APPROVED_WITH_REMARKS: "success",
  REJECTED: "dark",
  CORRECTIONS_PENDING: "light",
  PUBLISHED: "success",
  ARCHIVED: "neutral",
}

export const thesisStatusOptions: Array<{ value: ThesisStatus; label: string }> = (
  Object.keys(thesisStatusLabels) as ThesisStatus[]
).map((value) => ({ value, label: thesisStatusLabels[value] }))

export const reviewDecisionLabels: Record<ThesisReviewDecision, string> = {
  APPROVED: "Aprovada",
  CHANGES_REQUESTED: "Ajustes solicitados",
  REJECTED: "Reprovada",
}

export const reviewDecisionTones: Record<ThesisReviewDecision, BadgeTone> = {
  APPROVED: "success",
  CHANGES_REQUESTED: "light",
  REJECTED: "dark",
}

export const defenseResultLabels: Record<ThesisDefenseResult, string> = {
  APPROVED: "Aprovada",
  APPROVED_WITH_REMARKS: "Aprovada com ressalvas",
  REJECTED: "Reprovada",
}

export const documentTypeLabels: Record<ThesisDocumentType, string> = {
  DEFENSE_MINUTES: "Ata de defesa",
  PUBLICATION_AUTHORIZATION: "Autorização de publicação",
  SPELLING_CHECK_PROOF: "Comprovante de revisão ortográfica",
  OTHER: "Outro documento",
}

export const documentTypeOptions: Array<{ value: ThesisDocumentType; label: string }> = (
  Object.keys(documentTypeLabels) as ThesisDocumentType[]
).map((value) => ({ value, label: documentTypeLabels[value] }))

export const documentStatusLabels: Record<ThesisDocumentStatus, string> = {
  PENDING: "Pendente",
  SUBMITTED: "Enviado",
  VALIDATED: "Validado",
  REJECTED: "Rejeitado",
}

export const documentStatusTones: Record<ThesisDocumentStatus, BadgeTone> = {
  PENDING: "neutral",
  SUBMITTED: "active",
  VALIDATED: "success",
  REJECTED: "dark",
}

export const workflowSteps = [
  "Rascunho",
  "Submissão",
  "Orientador",
  "Banca",
  "Publicação",
]

export function thesisStatusLabel(status: string): string {
  return thesisStatusLabels[status as ThesisStatus] ?? status
}

export function thesisStatusTone(status: string): BadgeTone {
  return thesisStatusTones[status as ThesisStatus] ?? "neutral"
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed)
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—"
  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const formatted = value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)
  return `${formatted} ${units[unitIndex]}`
}

export function shortHash(hash: string | null | undefined): string {
  if (!hash) return "—"
  return `${hash.slice(0, 12)}…${hash.slice(-8)}`
}
