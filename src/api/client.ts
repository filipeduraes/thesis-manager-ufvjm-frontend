import type { Profile } from "../types"

const API_ROOT = `${process.env.REACT_APP_API_BASE_URL ?? "http://localhost:8000"}/api/v1`

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

let sessionCsrfToken = ""

function csrfToken(): string {
  if (sessionCsrfToken) return sessionCsrfToken
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("csrftoken="))
  return cookie ? decodeURIComponent(cookie.slice("csrftoken=".length)) : ""
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
    const detail = body.detail ?? Object.values(body).flat().join(" ")
    throw new ApiError(detail || "Não foi possível concluir a solicitação.", response.status)
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
  authType: "google" | "institutional" | "external" | null
  user: SessionUser | null
  csrfToken: string
  externalInvitation: {
    id: string
    name: string
    email: string
    institution: string
    expiresAt: string
  } | null
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
  logout: () => apiRequest<void>("/session", { method: "DELETE" }),
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
  user: { id: string; name: string; email: string; isActive: boolean } | null
  message: string
}

export const adminApi = {
  users: (query = "") =>
    apiRequest<PaginatedResponse<AdminUser>>(`/admin/users${query}`),
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
  departments: (query = "") =>
    apiRequest<{ results: AdminDepartment[]; count: number }>(
      `/admin/departments${query}`,
    ),
  createDepartment: (body: { name: string }) =>
    apiRequest<AdminDepartment>("/admin/departments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  courses: (query = "") =>
    apiRequest<PaginatedResponse<AdminCourse>>(`/admin/courses${query}`),
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
  auditLogs: (query = "") =>
    apiRequest<{ results: AuditRecord[]; count?: number }>(`/admin/audit-logs${query}`),
  exportAuditLogs: async (query = ""): Promise<void> => {
    const path = `/admin/audit-logs${query}${query.includes("?") ? "&" : "?"}export=csv`
    const response = await fetch(`${API_ROOT}${path}`, {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "text/csv,application/json" },
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      const detail = (body as { detail?: string }).detail ?? "Não foi possível exportar o log."
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

export interface AuditRecord {
  id: string
  timestamp: string
  actor: string
  role: string
  action: string
  actionCode?: string
  actionLabel?: string
  summary?: string
  entityType: string
  entityAppLabel?: string
  entityId: string
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
