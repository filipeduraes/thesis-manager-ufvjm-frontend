/**
 * Apresentação de registros de auditoria no frontend.
 *
 * O backend fornece códigos, identificadores e contexto estruturado; rótulos,
 * frases e formatação são montados aqui.
 */

export interface AuditEventData {
  id: string
  timestamp: string
  action: string
  category: string
  entity: { type: string; id: string; name: string; reference: string; exists?: boolean }
  actor: { id: string | null; name: string; email: string | null; roles: string[]; isExternal: boolean }
  origin: string
  ipAddress: string | null
  metadata: Record<string, unknown>
  changes: Record<string, unknown>
}

const ACTION_VERBS: Record<string, string> = {
  LOGIN: "Entrou no sistema",
  LOGOUT: "Saiu do sistema",
  LOGIN_FAILED: "Tentou entrar no sistema sem sucesso",
  TOKEN_ACCESS: "Acessou com token externo",
  CREATE: "Criou",
  READ: "Consultou",
  UPDATE: "Atualizou",
  DELETE: "Excluiu",
  UPLOAD: "Enviou",
  DOWNLOAD: "Baixou",
  REVIEW: "Revisou",
  SCHEDULE: "Agendou",
  EVALUATE: "Avaliou",
  PUBLISH: "Publicou",
  INVITE: "Convidou",
  APPROVE: "Aprovou",
  REJECT: "Rejeitou",
}

const ENTITY_NOUNS: Record<string, string> = {
  User: "o usuário",
  Course: "o curso",
  Department: "o departamento",
  UserCourseAssignment: "o vínculo de curso",
  ExternalInvitation: "o convite externo",
  Thesis: "o TCC",
  ThesisFile: "o TCC",
  ThesisDocument: "o documento do TCC",
  Defense: "a defesa",
  ReportOverview: "o relatório geral",
}

function withPreposition(noun: string): string {
  if (noun.startsWith("o ")) return `do ${noun.slice(2)}`
  if (noun.startsWith("a ")) return `da ${noun.slice(2)}`
  return `de ${noun}`
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value)
}

/**
 * Build the human-readable sentence shown in the audit table and modal.
 *
 * @param event Structured event returned by the API.
 * @param fallback Legacy phrase returned by older backends.
 * @returns A Portuguese sentence describing the operation.
 */
export function buildAuditSummary(event: AuditEventData | undefined, fallback = ""): string {
  if (!event) return fallback
  const action = event.action
  const verb = ACTION_VERBS[action] ?? (fallback || action)
  const noun = ENTITY_NOUNS[event.entity.type] ?? "o registro"
  const name = event.entity.name || event.entity.reference
  const target = name ? `${noun} "${name}"` : noun

  if (["LOGIN", "LOGOUT", "LOGIN_FAILED", "TOKEN_ACCESS"].includes(action)) return verb
  if (action === "DOWNLOAD") {
    const version = text(event.metadata.versionNumber)
    if (!version) return `${verb} ${target}`
    return name
      ? `${verb} a versão ${version} ${withPreposition(noun)} "${name}"`
      : `${verb} a versão ${version} ${target}`
  }
  if (action === "EVALUATE") {
    const score = event.metadata.score
    return score === undefined || score === null ? `${verb} ${target}` : `${verb} ${target} com ${score} pontos`
  }
  if (action === "PUBLISH") return `${verb} ${target} no repositório`
  if (["CREATE", "UPDATE", "DELETE", "READ", "UPLOAD", "REVIEW", "SCHEDULE", "INVITE", "APPROVE", "REJECT"].includes(action)) {
    return `${verb} ${target}`
  }
  return fallback || `${verb} ${target}`
}
