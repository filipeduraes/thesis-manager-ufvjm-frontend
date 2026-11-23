import { ApiError, type DefenseCommitteeMember } from "../../api/client"

const SENT_AT_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
})

/**
 * Describes the e-mail invitation of an external member for whoever manages the defense.
 *
 * The access code itself never reaches the browser: the backend e-mails it, so the
 * screen only reports where it went and whether the e-mail already left the queue.
 *
 * @returns The sentence to show, or null when the viewer cannot see the invitation
 *   (institutional member or viewer without `canManage`).
 */
export function invitationStatusText(member: DefenseCommitteeMember): string | null {
  if (member.isInstitutional || !member.invitationStatus) return null
  switch (member.invitationStatus) {
    case "USED":
      return `Convite já utilizado por ${member.email}. Para um novo acesso, gere um novo convite.`
    case "EXPIRED":
      return `Convite para ${member.email} expirado. Gere um novo convite.`
    case "REVOKED":
      return `Convite para ${member.email} revogado. Gere um novo convite.`
    case "DECLINED":
      return `Convite recusado por ${member.email}.`
    default:
      break
  }
  if (!member.invitationSentAt) {
    return `Envio do convite para ${member.email} em processamento. Use "Atualizar" para acompanhar.`
  }
  const sentAt = SENT_AT_FORMATTER.format(new Date(member.invitationSentAt))
  return `Convite enviado para ${member.email} em ${sentAt}.`
}

/**
 * Message for a failed invitation action (resend or new invitation).
 *
 * 429 gets its own wording because both actions share a small per-user limit; 400
 * carries the backend reason (for example, an expired invitation that must be replaced).
 */
export function invitationActionErrorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof ApiError && reason.status === 429) {
    return "Muitas solicitações de convite em sequência. Aguarde um minuto e tente novamente."
  }
  if (reason instanceof ApiError && (reason.status === 403 || reason.status === 404)) {
    return "Você não tem permissão para esta ação."
  }
  return reason instanceof Error && reason.message ? reason.message : fallback
}
