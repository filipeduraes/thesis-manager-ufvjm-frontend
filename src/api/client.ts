import type { CommitteeRoleCode, DefenseModalityCode, Profile } from "../types"

import { normalizeErrorBody } from "./errors"

const API_ORIGIN = process.env.REACT_APP_API_BASE_URL ?? "http://localhost:8000"
const API_ROOT = `${API_ORIGIN}/api/v1`

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

let sessionCsrfToken = ""

function csrfToken(): string {
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("csrftoken="))
  const cookieToken = cookie ? decodeURIComponent(cookie.slice("csrftoken=".length)) : ""
  // O cookie é a fonte da verdade: logout e expiração o rotacionam no servidor.
  if (cookieToken && cookieToken !== sessionCsrfToken) {
    sessionCsrfToken = cookieToken
  }
  return sessionCsrfToken || cookieToken
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase()
  const headers = new Headers(init.headers)
  headers.set("Accept", "application/json")
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = csrfToken()
    if (token) headers.set("X-CSRFToken", token)
  }

  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include",
    cache: "no-store",
  })
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = normalizeErrorBody(body, "Não foi possível concluir a solicitação.")
    throw new ApiError(detail, response.status)
  }
  return body as T
}

export interface SessionUser {
  id: string
  name: string
  email: string
  affiliation: string
  status: "Ativo" | "Inativo"
  initials: string
  avatarUrl: string | null
  course: string | null
  lastAccess: string | null
  roleCode: string | null
  roleLabel: string
  roles: Array<{ code: string; label: string }>
}

export interface SessionPayload {
  authenticated: boolean
  authType: "google" | "institutional" | "external" | "dev" | null
  user: SessionUser | null
  csrfToken: string
  externalInvitation: {
    id: string
    name: string
    email: string
    institution: string
    expiresAt: string
    /** Bancas do convite (vínculo um-para-um com o membro externo, então hoje no máximo uma). */
    assignments?: ExternalAssignment[]
  } | null
}

/** Item de externalInvitation.assignments em GET /session (external_invitation_assignments). */
export interface ExternalAssignment {
  defenseId: string
  memberId: string
}

export interface DevUser {
  id: string
  name: string
  email: string
  roleCode: string | null
  roleLabel: string
  roles?: string[]
}

export const authApi = {
  async getSession(): Promise<SessionPayload> {
    const session = await apiRequest<SessionPayload>("/session")
    sessionCsrfToken = session.csrfToken ?? ""
    return session
  },
  async beginGoogleLogin(): Promise<void> {
    const { url } = await apiRequest<{ url: string }>("/auth/google/start")
    window.location.assign(url)
  },
  exchangeExternalToken: (token: string) =>
    apiRequest<{ authenticated: boolean }>("/auth/external-token", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  async devLogin(payload: {
    name: string
    email: string
    roles: string[]
  }): Promise<SessionPayload> {
    const session = await apiRequest<SessionPayload>("/auth/dev-login", {
      method: "POST",
      body: JSON.stringify(payload),
    })
    sessionCsrfToken = session.csrfToken ?? ""
    return session
  },
  listDevUsers: () =>
    apiRequest<{ results: DevUser[] }>("/auth/dev-users"),
  logout: async () => {
    const response = await apiRequest<void>("/session", { method: "DELETE" })
    sessionCsrfToken = ""
    return response
  },
}

export const profileToCode: Record<Profile, string> = {
  Aluno: "STUDENT",
  Orientador: "ADVISOR",
  Coordenador: "COORDINATOR",
  Administrador: "ADMIN",
}

export function codeToProfile(code: string | null | undefined): Profile {
  const match = Object.entries(profileToCode).find(([, value]) => value === code)
  return (match?.[0] as Profile | undefined) ?? "Aluno"
}

export interface PaginatedResponse<T> {
  count: number
  page: number
  pageSize: number
  totalPages: number
  lastPageCount: number
  next?: string | null
  previous?: string | null
  results: T[]
}

export interface AdminDepartment {
  id: string
  name: string
}

export interface AdminCourseCoordinator {
  id: string | null
  name: string
  email: string
  isActive: boolean
  status: "FOUND_ACTIVE" | "FOUND_INACTIVE" | "PENDING"
}

export interface AdminCourse {
  id: string
  name: string
  code: string
  department: AdminDepartment
  departmentId: string
  coordinator: AdminCourseCoordinator | null
  coordinatorEmail: string
  coordinatorStatus: "FOUND_ACTIVE" | "FOUND_INACTIVE" | "PENDING"
  activeStudents: number
  publishedTheses: number
}

export interface UserLookupResult {
  found: boolean
  /** `avatarUrl` é a foto da conta Google (https) ou null quando não há foto. */
  user: { id: string; name: string; email: string; isActive: boolean; avatarUrl: string | null } | null
  message: string
}

export const adminApi = {
  users: (query = "", signal?: AbortSignal) =>
    apiRequest<PaginatedResponse<AdminUser>>(`/admin/users${query}`, { signal }),
  updateUser: (id: string, body: Record<string, unknown>) =>
    apiRequest<AdminUser>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  createUser: (body: Record<string, unknown>) =>
    apiRequest<AdminUser>("/admin/users", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deactivateUser: (id: string) =>
    apiRequest<void>(`/admin/users/${id}`, { method: "DELETE" }),
  lookupUser: (email: string) =>
    apiRequest<UserLookupResult>(
      `/admin/users/lookup?email=${encodeURIComponent(email)}`,
    ),
  departments: (query = "", signal?: AbortSignal) =>
    apiRequest<{ results: AdminDepartment[]; count: number }>(
      `/admin/departments${query}`, { signal },
    ),
  createDepartment: (body: { name: string }) =>
    apiRequest<AdminDepartment>("/admin/departments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  courses: (query = "", signal?: AbortSignal) =>
    apiRequest<PaginatedResponse<AdminCourse>>(`/admin/courses${query}`, { signal }),
  createCourse: (body: Record<string, unknown>) =>
    apiRequest<AdminCourse>("/admin/courses", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateCourse: (id: string, body: Record<string, unknown>) =>
    apiRequest<AdminCourse>(`/admin/courses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteCourse: (id: string) =>
    apiRequest<void>(`/admin/courses/${id}`, { method: "DELETE" }),
  auditLogs: (query = "", signal?: AbortSignal) =>
    apiRequest<AuditLogsPage>(`/admin/audit-logs${query}`, { signal }),
  exportAuditLogs: async (query = ""): Promise<void> => {
    const path = `/admin/audit-logs${query}${query.includes("?") ? "&" : "?"}export=csv`
    const response = await fetch(`${API_ROOT}${path}`, {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "text/csv,application/json" },
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      const detail = normalizeErrorBody(body, "Não foi possível exportar o log.")
      if (response.status === 404) {
        throw new ApiError("Exportação indisponível. Reinicie o backend para carregar a rota de auditoria.", response.status)
      }
      throw new ApiError(detail, response.status)
    }
    const blob = await response.blob()
    const disposition = response.headers.get("Content-Disposition") ?? ""
    const match = disposition.match(/filename="?([^"]+)"?/i)
    const filename = match?.[1] ?? "audit-logs.csv"
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(url)
  },
  createInvitation: (body: { name: string; email: string; institution: string }) =>
    apiRequest<{ id: string; token: string; expiresAt: string }>(
      "/admin/external-invitations",
      { method: "POST", body: JSON.stringify(body) },
    ),
  invitations: () =>
    apiRequest<{ results: ExternalInvitationRecord[] }>("/admin/external-invitations"),
  revokeInvitation: (id: string) =>
    apiRequest<void>(`/admin/external-invitations/${id}`, { method: "DELETE" }),
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  roleCode: string | null
  status: "Ativo" | "Inativo"
  initials: string
  avatarUrl: string | null
  course: string | null
  courseId: string | null
  lastAccess: string | null
  roles: Array<{ code: string; label: string }>
}

/** Page-number pagination metadata returned by the audit log endpoint. */
export interface AuditLogsPage {
  count: number
  next: string | null
  previous: string | null
  results: AuditRecord[]
}

export interface AuditRecord {
  id: string
  timestamp: string
  actor: string
  actorEmail?: string | null
  role: string
  roles?: Array<{ code: string; label: string }>
  roleCodes?: string[]
  action: string
  actionCode?: string
  actionLabel?: string
  summary?: string
  category?: string
  categoryLabel?: string
  verbosity?: "TRACE" | "RELEVANT"
  verbosityLabel?: string
  entityType: string
  entityTypeLabel?: string
  entityAppLabel?: string
  entityId: string
  entityName?: string
  entityNameShort?: string
  entityReference?: string
  details?: Array<{ label: string; value: string; before?: string; after?: string }>
  origin: string
  originCode?: string
  ipAddress?: string | null
  channel?: string
  hash: string
  changes?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface ExternalInvitationRecord {
  id: string
  name: string
  email: string
  institution: string
  status: string
  expiresAt: string
  usedAt: string | null
}

// ─── Directory API ────────────────────────────────────────────────────────────

/** Usuário institucional mínimo devolvido pela busca de autocomplete. */
export interface UserSuggestion {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

/** Busca de usuários institucionais para autocomplete (admin, coordenador e orientador). */
export const usersApi = {
  suggest: (query: string) =>
    apiRequest<{ results: UserSuggestion[] }>(`/users/suggest${queryString({ q: query })}`),
}

// ─── Reports API ──────────────────────────────────────────────────────────────

/** Contadores de monografias (não excluídas e fora de rascunho). */
export interface ReportThesisCounters {
  thesisCount: number
  inProgressCount: number
  publishedCount: number
}

/**
 * Defense-level counters. `approvalRate` is a 0–1 ratio per completed defense,
 * (approved + approved with remarks) / defenses with a recorded result, and is
 * `null` when no defense has a result; `averageSubmissionToDefenseDays` is `null`
 * when no completed defense could be measured.
 */
export interface ReportDefenseCounters {
  completedDefenseCount: number
  approvedCount: number
  approvedWithRemarksCount: number
  rejectedCount: number
  approvalRate: number | null
  averageSubmissionToDefenseDays: number | null
}

export interface ReportSummary extends ReportThesisCounters, ReportDefenseCounters {
  scheduledDefenseCount: number
}

export interface ReportCourseRow extends ReportThesisCounters, ReportDefenseCounters {
  courseId: string
  courseCode: string
  courseName: string
}

export interface ReportAdvisorRow extends ReportThesisCounters, ReportDefenseCounters {
  advisorId: string
  advisorName: string
}

export interface ReportYearRow extends ReportDefenseCounters {
  year: number
}

export interface ReportsOverview {
  /** `ALL` para administradores; `COORDINATED_COURSES` para coordenadores (ou admin com `scope=coordinated`). */
  scope: "ALL" | "COORDINATED_COURSES"
  filters: { courseId: string | null; advisorId: string | null; year: number | null }
  summary: ReportSummary
  byCourse: ReportCourseRow[]
  byAdvisor: ReportAdvisorRow[]
  byDefenseYear: ReportYearRow[]
  /** Valores de filtro disponíveis no escopo do usuário (não dependem dos filtros aplicados). */
  options: {
    courses: Array<{ id: string; code: string; name: string }>
    advisors: Array<{ id: string; name: string }>
    years: number[]
  }
}

export interface ReportsOverviewParams {
  courseId?: string
  advisorId?: string
  /** Ano da banca concluída (fuso America/Sao_Paulo). */
  year?: number
  /** Restringe o administrador aos cursos que ele também coordena. */
  scope?: "coordinated"
}

const REPORT_PDF_FALLBACK_NAME = "relatorio-tcc.pdf"

/**
 * Reporting endpoints (backend app `reports`).
 *
 * `GET /reports/overview` — ADMIN sees every course, COORDINATOR only the
 * courses linked to them; advisors, students and external sessions get 403,
 * invalid filters 400 (field-keyed messages), throttle scope `reports` (60/min,
 * 429). Responses are cached by the backend for 60 s, so figures may lag by up
 * to a minute. All aggregates are computed by the backend; render them as-is.
 *
 * `GET /reports/overview/pdf` — same filters, permissions and cached figures,
 * returned as an `application/pdf` attachment (`relatorio-tcc-AAAAMMDD-HHMM.pdf`).
 * Its own throttle scope `reports_export` (10/min); errors are JSON.
 */
export const reportsApi = {
  overview: (params: ReportsOverviewParams = {}) =>
    apiRequest<ReportsOverview>(`/reports/overview${queryString({ ...params })}`),
  /**
   * Downloads the overview report as a PDF generated by the backend and saves it
   * through a temporary object URL.
   *
   * @throws {ApiError} With the HTTP status (403, 429, 400…) and the backend message.
   */
  exportPdf: async (params: ReportsOverviewParams = {}): Promise<void> => {
    const response = await fetch(`${API_ROOT}/reports/overview/pdf${queryString({ ...params })}`, {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/pdf, application/json" },
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      const detail = body.detail ?? Object.values(body).flat().join(" ")
      throw new ApiError(detail || "Não foi possível gerar o PDF.", response.status)
    }
    const blob = await response.blob()
    const disposition = response.headers.get("Content-Disposition")
    const filename = filenameFromDisposition(disposition, REPORT_PDF_FALLBACK_NAME)
    saveBlob(blob, filename, REPORT_PDF_FALLBACK_NAME)
  },
}

// ─── Defense API ──────────────────────────────────────────────────────────────

export const DEFENSE_RESULT_LABELS: Record<string, string> = {
  APPROVED: "Aprovada",
  APPROVED_WITH_REMARKS: "Aprovada com ressalvas",
  REJECTED: "Reprovada",
}

export const COMMITTEE_ROLE_LABELS: Record<string, string> = {
  PRESIDENT: "Presidente",
  MEMBER: "Membro",
  ALTERNATE: "Suplente",
}

export const COMMITTEE_ROLE_OPTIONS = [
  { value: "PRESIDENT", label: "Presidente" },
  { value: "MEMBER", label: "Membro" },
  { value: "ALTERNATE", label: "Suplente" },
] as const

/** Avaliação individual de um membro da banca, retornada pelo backend. */
export interface DefenseMemberEvaluationData {
  id: string
  decision: string
  decisionLabel: string
  submittedAt: string
  score?: string | null
  notes?: string
  updatedAt?: string
}

/** Membro da comissão, tal como retornado em defense_member_payload. */
export interface DefenseCommitteeMember {
  id: string
  role: string
  roleLabel: string
  name: string
  email: string
  institution: string
  hasConflict: boolean
  conflictReason: string
  isInstitutional: boolean
  /** Foto da conta Google do membro institucional; null para externos e para quem não tem foto. */
  avatarUrl: string | null
  /**
   * Resposta do membro sobre o horário; volta a PENDING quando data ou duração mudam.
   * Os quatro campos de disponibilidade vêm null para quem não gerencia a banca
   * (`viewerPermissions.canManage`), exceto na linha do próprio membro.
   */
  availabilityStatus: AvailabilityStatusCode | null
  availabilityStatusLabel: string | null
  availabilityRespondedAt: string | null
  availabilityNote: string | null
  createdAt: string
  evaluation: DefenseMemberEvaluationData | null
}

/** Códigos de AvailabilityStatus no backend. */
export type AvailabilityStatusCode = "PENDING" | "CONFIRMED" | "DECLINED"

/** Item de pendingConfirmations em GET /defenses/{id} (defense_availability_summary). */
export interface DefensePendingConfirmation {
  memberId: string
  name: string
  role: string
  roleLabel: string
  availabilityStatus: AvailabilityStatusCode
}

/** Entrada de statusHistory em GET /defenses/{id} (defense_status_history_payload). */
export interface DefenseStatusHistoryEntry {
  /** null no agendamento (primeira entrada). */
  previousStatus: string | null
  previousStatusLabel: string | null
  newStatus: string
  newStatusLabel: string
  /** Nome ou e-mail de quem mudou; null em transições automáticas. */
  changedBy: string | null
  reason: string
  createdAt: string
}

/** Arquivo atual da monografia, conforme thesis_summary_payload. */
export interface DefenseThesisSummaryFile {
  id: string
  versionNumber: number
  originalFilename: string
  sizeBytes: number
  sha256: string
  uploadedAt: string
  /** null em sessões externas, que não podem acessar as rotas institucionais. */
  previewUrl: string | null
  downloadUrl: string | null
}

/**
 * Resumo da monografia anexado às bancas para navegação e leitura do PDF.
 * Evita uma segunda requisição em `/defenses` e `/defenses/{id}`.
 */
export interface DefenseThesisSummary {
  id: string
  referenceCode: string
  title: string
  type: string
  typeLabel: string
  status: ThesisStatus
  statusLabel: string
  isPublic: boolean
  course: ThesisCourseBrief
  advisor: ThesisUserBrief | null
  student: ThesisUserBrief | null
  keywords: string[]
  submittedAt: string | null
  publishedAt: string | null
  currentFile: DefenseThesisSummaryFile | null
}

/** Payload de uma defesa, tal como retornado por defense_payload. */
export interface DefenseData {
  id: string
  thesis: string
  /** Id da monografia; equivalente a `thesis`, exposto para telas que usam o resumo. */
  thesisId?: string
  /** Resumo da monografia embutido no detalhe e na listagem (thesis_summary_payload). */
  thesisSummary?: DefenseThesisSummary
  scheduledDatetime: string
  durationMinutes: number
  modality: string
  modalityLabel: string
  location: string
  notes: string
  status: string
  statusLabel: string
  /** Resultado gravado no encerramento (manual ou automático); null até COMPLETED. */
  result?: string | null
  resultLabel?: string | null
  createdAt: string
  updatedAt: string
  members: DefenseCommitteeMember[]
  /** Só vem no detalhe (GET /defenses/{id}); bancas anteriores à migration 0005 vêm sem histórico. */
  statusHistory?: DefenseStatusHistoryEntry[]
  /** Só no detalhe: há membros não suplentes e todos confirmaram disponibilidade. */
  allMembersConfirmed?: boolean
  /**
   * Só no detalhe: não suplentes que ainda não confirmaram (pendentes ou indisponíveis).
   * null significa que a lista está oculta para quem não gerencia a banca, não que
   * ninguém está pendente.
   */
  pendingConfirmations?: DefensePendingConfirmation[] | null
  /** Só no detalhe (e na listagem): vínculo do usuário autenticado ou da sessão externa. */
  viewerMembership?: DefenseViewerMembership
  /** Só no detalhe e na listagem: ações que o backend aceita deste usuário nesta banca. */
  viewerPermissions?: DefenseViewerPermissions
}

/**
 * Actions the signed-in viewer may perform on one defense (`DefenseViewerPermissions`
 * in the backend). Each flag already combines the viewer's rights and the defense status,
 * but not business preconditions: `canStart` ignores availability confirmations
 * (`allMembersConfirmed`) and `canClose` ignores missing evaluations, so the backend may
 * still reject those calls.
 */
export interface DefenseViewerPermissions {
  /** The viewer manages the defense (`_can_manage_defense`): sees every member's availability. */
  canManage: boolean
  canEdit: boolean
  canCancel: boolean
  canStart: boolean
  canClose: boolean
  /** Administrators only, while the defense is in progress or cancelled. */
  canRevert: boolean
  /** Add members and regenerate external tokens while the defense is scheduled or in progress. */
  canManageMembers: boolean
}

/** Permissions assumed when a payload has no `viewerPermissions`: nothing is allowed. */
export const NO_DEFENSE_PERMISSIONS: DefenseViewerPermissions = {
  canManage: false,
  canEdit: false,
  canCancel: false,
  canStart: false,
  canClose: false,
  canRevert: false,
  canManageMembers: false,
}

/**
 * Resposta de POST /defenses/{id}/members/external e de .../regenerate-token.
 * O accessToken vem uma única vez (Cache-Control: no-store) e nunca deve ser guardado.
 */
export interface ExternalMemberTokenResponse {
  member: DefenseCommitteeMember
  accessToken: string
  accessTokenExpiresAt: string
}

/** Resposta de PUT .../evaluation: a última avaliação pode encerrar a banca automaticamente. */
export interface SubmitEvaluationResponse {
  evaluation: DefenseMemberEvaluationData
  /** Mensagem quando o encerramento automático falhou; a avaliação continua salva. */
  autoCloseError: string | null
  defenseStatus: string
  defenseStatusLabel: string
}

/** Corpo de POST /theses/{thesisId}/defenses (ScheduleDefenseSerializer). */
export interface ScheduleDefenseInput {
  /** ISO 8601 com deslocamento explícito (ex.: 2026-11-20T14:00:00-03:00). */
  scheduledDatetime: string
  durationMinutes: number
  modality: DefenseModalityCode
  location: string
  notes?: string
}

/** Corpo de PATCH /defenses/{id} (UpdateDefenseSerializer): todos os campos são opcionais. */
export type UpdateDefenseInput = Partial<ScheduleDefenseInput>

/** Situação do usuário autenticado na banca, calculada pelo backend. */
export interface DefenseViewerMembership {
  isMember: boolean
  memberId: string | null
  role: CommitteeRoleCode | null
  roleLabel: string | null
  canEvaluate: boolean
  hasEvaluated: boolean
}

/** Item de GET /defenses (defense_list_payload). */
export interface DefenseListItem extends DefenseData {
  thesisTitle: string
  thesisReferenceCode: string
  student: ThesisUserBrief | null
  advisor: ThesisUserBrief | null
  viewerMembership: DefenseViewerMembership
  viewerPermissions: DefenseViewerPermissions
}

export interface DefenseListParams {
  /** Busca livre: título, código, aluno principal, orientador ou local. */
  q?: string
  /** Códigos DefenseStatus separados por vírgula (ex.: "SCHEDULED,IN_PROGRESS"). */
  status?: string
  /** Somente bancas ativas em que o usuário é membro titular sem parecer. */
  pendingEvaluation?: boolean
  page?: number
  pageSize?: number
}

/**
 * Endpoints relacionados à banca de defesa.
 * Endpoints reais (theses/urls.py):
 *   GET  /defenses                           — bancas visíveis ao usuário (paginado)
 *   GET  /defenses/schedulable-theses        — teses aptas a agendar (paginado)
 *   POST /theses/{thesisId}/defenses         — agenda nova banca
 *   GET  /defenses/{id}
 *   PATCH /defenses/{id}                     — altera data, duração, modalidade, local ou notas (só SCHEDULED)
 *   POST /defenses/{id}/cancel               — cancela banca agendada (motivo opcional)
 *   POST /defenses/{id}/members              — membro institucional
 *   POST /defenses/{id}/members/external     — membro externo (endpoint distinto do enunciado original)
 *   DELETE /defenses/{id}/members/{member_id}
 *   POST /defenses/{id}/members/{member_id}/availability    — o próprio membro confirma ou recusa
 *   POST /defenses/{id}/members/{member_id}/regenerate-token — novo token do membro externo
 *   GET/PUT /defenses/{id}/members/{member_id}/evaluation
 */
export const defenseApi = {
  list: (params: DefenseListParams = {}, signal?: AbortSignal) =>
    apiRequest<PaginatedResponse<DefenseListItem>>(
      `/defenses${queryString({ ...params })}`, { signal },
    ),

  schedulableTheses: (params: { page?: number; pageSize?: number } = {}) =>
    apiRequest<PaginatedResponse<ThesisListItem>>(
      `/defenses/schedulable-theses${queryString({ ...params })}`,
    ),

  schedule: (thesisId: string, body: ScheduleDefenseInput) =>
    apiRequest<{ defense: DefenseData }>(
      `/theses/${encodeURIComponent(thesisId)}/defenses`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  get: (defenseId: string) =>
    apiRequest<{ defense: DefenseData }>(`/defenses/${defenseId}`),

  addInstitutionalMember: (
    defenseId: string,
    body: { role: string; userId: string; conflictReason?: string },
  ) =>
    apiRequest<{ member: DefenseCommitteeMember }>(
      `/defenses/${defenseId}/members`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  addExternalMember: (
    defenseId: string,
    body: {
      role: string
      name: string
      email: string
      institution?: string
      conflictReason?: string
    },
  ) =>
    apiRequest<ExternalMemberTokenResponse>(
      `/defenses/${defenseId}/members/external`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  removeMember: (defenseId: string, memberId: string) =>
    apiRequest<void>(`/defenses/${defenseId}/members/${memberId}`, {
      method: "DELETE",
    }),

  submitEvaluation: (
    defenseId: string,
    memberId: string,
    body: { decision: string; score?: string | null; notes?: string },
  ) =>
    apiRequest<SubmitEvaluationResponse>(
      `/defenses/${defenseId}/members/${memberId}/evaluation`,
      { method: "PUT", body: JSON.stringify(body) },
    ),

  respondAvailability: (
    defenseId: string,
    memberId: string,
    body: { status: Exclude<AvailabilityStatusCode, "PENDING">; note?: string },
  ) =>
    apiRequest<{ member: DefenseCommitteeMember }>(
      `/defenses/${defenseId}/members/${memberId}/availability`,
      { method: "POST", body: JSON.stringify(body) },
    ),

  regenerateToken: (defenseId: string, memberId: string) =>
    apiRequest<ExternalMemberTokenResponse>(
      `/defenses/${defenseId}/members/${memberId}/regenerate-token`,
      { method: "POST" },
    ),

  update: (defenseId: string, body: UpdateDefenseInput) =>
    apiRequest<{ defense: DefenseData }>(`/defenses/${defenseId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  cancel: (defenseId: string, reason: string) =>
    apiRequest<{ defense: DefenseData }>(`/defenses/${defenseId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  revertStatus: (defenseId: string, reason: string) =>
    apiRequest<{ defense: DefenseData }>(`/defenses/${defenseId}/revert-status`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  start: (defenseId: string) =>
    apiRequest<{ defense: DefenseData }>(`/defenses/${defenseId}/start`, {
      method: "POST",
    }),

  close: (defenseId: string) =>
    apiRequest<{ defense: DefenseData }>(`/defenses/${defenseId}/close`, {
      method: "POST",
    }),
}

export type ThesisStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "ADVISOR_REVIEW"
  | "CHANGES_REQUESTED"
  | "ADVISOR_APPROVED"
  | "READY_FOR_DEFENSE"
  | "DEFENSE_SCHEDULED"
  | "UNDER_EVALUATION"
  | "APPROVED"
  | "APPROVED_WITH_REMARKS"
  | "REJECTED"
  | "CORRECTIONS_PENDING"
  | "PUBLISHED"
  | "ARCHIVED"

export type ThesisReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REJECTED"

export type ThesisDefenseResult = "APPROVED" | "APPROVED_WITH_REMARKS" | "REJECTED"

export type ThesisDocumentType =
  | "DEFENSE_MINUTES"
  | "PUBLICATION_AUTHORIZATION"
  | "SPELLING_CHECK_PROOF"
  | "OTHER"

export type ThesisDocumentStatus = "PENDING" | "SUBMITTED" | "VALIDATED" | "REJECTED"

export type ThesisProcessingStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "RETRYING"

export interface ThesisUserBrief {
  id: string
  name: string
  email: string
}

export interface ThesisCourseBrief {
  id: string
  name: string
  code: string
}

export interface ThesisStoredFile {
  id: string
  originalFilename: string
  mimeType: string
  extension: string
  sizeBytes: number
  sha256: string
  processingStatus: ThesisProcessingStatus
  uploadedAt: string
}

export interface ThesisFile {
  id: string
  versionNumber: number
  isCurrent: boolean
  changeDescription: string
  uploadedAt: string
  hashVerifiedAt: string | null
  storedFile: ThesisStoredFile
  downloadUrl: string
  previewUrl: string
}

export interface ThesisReview {
  id: string
  fileId: string
  decision: ThesisReviewDecision
  decisionLabel: string
  comments: string
  recommendations: string
  reviewedAt: string
  reviewer: ThesisUserBrief | null
}

export interface ThesisStatusHistoryEntry {
  id: string
  previousStatus: ThesisStatus | null
  newStatus: ThesisStatus
  newStatusLabel: string
  reason: string
  metadata: Record<string, unknown>
  changedAt: string
  changedBy: ThesisUserBrief | null
}

export interface ThesisDocument {
  id: string
  type: ThesisDocumentType
  typeLabel: string
  status: ThesisDocumentStatus
  statusLabel: string
  submittedAt: string
  validatedAt: string | null
  rejectionReason: string
  submittedBy: ThesisUserBrief | null
  validatedBy: ThesisUserBrief | null
  storedFile: ThesisStoredFile
  downloadUrl: string
}

export interface ThesisPermissions {
  canEdit: boolean
  canUpload: boolean
  canSubmit: boolean
  canWithdrawSubmission: boolean
  canReview: boolean
  canManage: boolean
  canPublish: boolean
  canRecordDefenseResult: boolean
  canUploadDocuments: boolean
}

export interface ThesisAuthorEntry {
  id: string
  position: number
  isMainAuthor: boolean
  user: ThesisUserBrief | null
}

export interface ThesisSummaryFile {
  id: string
  sizeBytes: number
  sha256: string
  uploadedAt: string
  previewUrl: string
  downloadUrl: string
}

export interface Thesis {
  id: string
  referenceCode: string
  type: string
  typeLabel: string
  title: string
  abstract: string
  journal: string
  status: ThesisStatus
  statusLabel: string
  statusDescription: string
  progressStep: number
  isPublic: boolean
  course: ThesisCourseBrief
  advisor: ThesisUserBrief
  student: ThesisUserBrief | null
  authors: ThesisAuthorEntry[]
  keywords: string[]
  currentFile: ThesisFile | null
  submittedAt: string | null
  advisorApprovedAt: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  permissions: ThesisPermissions
  files?: ThesisFile[]
  reviews?: ThesisReview[]
  statusHistory?: ThesisStatusHistoryEntry[]
  documents?: ThesisDocument[]
}

export interface ThesisListItem {
  id: string
  referenceCode: string
  title: string
  status: ThesisStatus
  statusLabel: string
  statusDescription: string
  progressStep: number
  isPublic: boolean
  course: ThesisCourseBrief
  advisor: ThesisUserBrief
  student: ThesisUserBrief | null
  keywords: string[]
  currentVersion: number | null
  currentFile: ThesisSummaryFile | null
  submittedAt: string | null
  updatedAt: string
  advisorApprovedAt: string | null
  pendingReview: boolean
  permissions: ThesisPermissions
}

export interface ThesisLimits {
  maxPdfSizeMb: number
  maxDocumentSizeMb: number
  maxKeywords: number
}

export interface StudentThesisContext {
  thesis: Thesis | null
  courses: ThesisCourseBrief[]
  advisors: ThesisUserBrief[]
  defaultCourseId: string | null
  limits: ThesisLimits
}

export interface ThesisMetadataInput {
  title: string
  abstract: string
  courseId: string
  advisorId: string
  keywords: string[]
  type?: string
  journal?: string
}

export interface ThesisListParams {
  scope?: "advised" | "authored" | "coordinated"
  q?: string
  status?: string
  courseId?: string
  advisorId?: string
  year?: string
  pendingReview?: boolean
  page?: number
  pageSize?: number
}

function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return
    search.set(key, String(value))
  })
  const serialized = search.toString()
  return serialized ? `?${serialized}` : ""
}

function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  if (path.startsWith("/api/v1")) return `${API_ORIGIN}${path}`
  return `${API_ROOT}${path}`
}

export interface PublicAdvisor {
  id: string
  name: string
}

export interface DirectoryUser extends PublicAdvisor {
  email: string
  roles: string[]
}

export interface PublicThesisSummary {
  id: string
  title: string
  course: ThesisCourseBrief
}

export interface PublicThesisDetail extends PublicThesisSummary {
  abstract: string
  student: { name: string } | null
  advisor: { name: string }
  keywords: string[]
  currentFile: {
    downloadUrl: string
    storedFile: { originalFilename: string }
  } | null
}

export const publicSearchApi = {
  theses: (q: string, pageSize: number, signal?: AbortSignal) =>
    apiRequest<PaginatedResponse<PublicThesisSummary>>(
      `/public/theses${queryString({ q, pageSize })}`, { signal },
    ),
  thesis: (id: string, signal?: AbortSignal) =>
    apiRequest<{ thesis: PublicThesisDetail }>(`/public/theses/${encodeURIComponent(id)}`, { signal }),
  advisors: (q: string, pageSize: number, signal?: AbortSignal) =>
    apiRequest<PaginatedResponse<PublicAdvisor>>(
      `/public/advisors${queryString({ q, pageSize })}`, { signal },
    ),
}

export const directoryApi = {
  users: (q: string, pageSize: number, signal?: AbortSignal) =>
    apiRequest<PaginatedResponse<DirectoryUser>>(
      `/users${queryString({ q, pageSize })}`, { signal },
    ),
}

export async function fetchApiBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(resolveApiUrl(path), {
    signal,
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/pdf,application/octet-stream" },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = (body as { detail?: string }).detail ?? "Não foi possível carregar o arquivo."
    throw new ApiError(detail, response.status)
  }
  return response.blob()
}

/**
 * Reads the file name from a `Content-Disposition` header (the backend exposes it
 * through CORS), falling back when it is missing or unreadable.
 */
function filenameFromDisposition(disposition: string | null, fallback: string): string {
  const match = disposition?.match(/filename="?([^";]+)"?/i)
  return match?.[1] ?? fallback
}

/** Saves a blob as a download, sanitizing the name and releasing the object URL afterwards. */
function saveBlob(blob: Blob, filename: string, fallbackName: string): void {
  const url = window.URL.createObjectURL(blob)
  const safeName = filename.replace(/[\\/:*?"<>|]+/g, "_").trim() || fallbackName
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = safeName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

export async function downloadApiFile(path: string, filename: string, signal?: AbortSignal): Promise<void> {
  const blob = await fetchApiBlob(path, signal)
  if (!signal?.aborted) saveBlob(blob, filename, "monografia.pdf")
}

export const thesesApi = {
  myThesis: () => apiRequest<StudentThesisContext>("/theses/me"),
  saveMetadata: (body: ThesisMetadataInput) =>
    apiRequest<{ thesis: Thesis }>("/theses/me", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  uploadFile: (file: File, changeDescription = "") => {
    const form = new FormData()
    form.append("file", file)
    if (changeDescription) form.append("changeDescription", changeDescription)
    return apiRequest<{ file: ThesisFile; thesis: Thesis }>("/theses/me/files", {
      method: "POST",
      body: form,
    })
  },
  submit: () =>
    apiRequest<{ thesis: Thesis }>("/theses/me/submit", { method: "POST" }),
  withdrawSubmission: () =>
    apiRequest<{ thesis: Thesis }>("/theses/me/withdraw", { method: "POST" }),
  list: (params: ThesisListParams = {}, signal?: AbortSignal) =>
    apiRequest<PaginatedResponse<ThesisListItem>>(
      `/theses${queryString({ ...params })}`, { signal },
    ),
  detail: (id: string, signal?: AbortSignal) =>
    apiRequest<{ thesis: Thesis }>(`/theses/${encodeURIComponent(id)}`, { signal }),
  review: (
    id: string,
    body: { decision: ThesisReviewDecision; comments?: string; recommendations?: string },
  ) =>
    apiRequest<{ thesis: Thesis; review: ThesisReview }>(`/theses/${id}/reviews`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  recordDefenseResult: (id: string, body: { result: ThesisDefenseResult; reason?: string }) =>
    apiRequest<{ thesis: Thesis }>(`/theses/${id}/defense-result`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  publish: (id: string) =>
    apiRequest<{ thesis: Thesis }>(`/theses/${id}/publish`, { method: "POST" }),
  uploadDocument: (id: string, type: ThesisDocumentType, file: File) => {
    const form = new FormData()
    form.append("type", type)
    form.append("file", file)
    return apiRequest<{ document: ThesisDocument }>(`/theses/${id}/documents`, {
      method: "POST",
      body: form,
    })
  },
  validateDocument: (id: string, documentId: string) =>
    apiRequest<{ document: ThesisDocument }>(
      `/theses/${id}/documents/${documentId}/validate`,
      { method: "POST" },
    ),
  downloadFile: (path: string, filename: string) => downloadApiFile(path, filename),
  fetchFile: (path: string) => fetchApiBlob(path),
}
