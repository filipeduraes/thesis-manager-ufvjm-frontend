import type { Profile } from "../types"

const API_ROOT = `${process.env.REACT_APP_API_BASE_URL ?? "http://localhost:8000"}/api/v1`

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function csrfToken(): string {
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
  role: string
  roleCode: string | null
  profile: string
  initials: string
}

export interface SessionPayload {
  authenticated: boolean
  authType: "google" | "institutional" | "external" | null
  user: SessionUser | null
  role: string | null
  profile: string | null
  roles: Array<{ code: string; label: string }>
  permissions: string[]
  externalInvitation: {
    id: string
    name: string
    email: string
    institution: string
    expiresAt: string
  } | null
}

export const authApi = {
  getSession: () => apiRequest<SessionPayload>("/session"),
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
  setActiveProfile: (profile: Profile) =>
    apiRequest<{ role: string; profile: string }>("/session/active-profile", {
      method: "PATCH",
      body: JSON.stringify({ role: profileToCode[profile] }),
    }),
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

export const adminApi = {
  users: (query = "") =>
    apiRequest<{ results: AdminUser[] }>(`/admin/users${query}`),
  updateUser: (id: string, body: Record<string, unknown>) =>
    apiRequest<AdminUser>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  createUser: (body: { name: string; email: string; roles: string[] }) =>
    apiRequest<AdminUser>("/admin/users", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deactivateUser: (id: string) =>
    apiRequest<void>(`/admin/users/${id}`, { method: "DELETE" }),
  auditLogs: (query = "") =>
    apiRequest<{ results: AuditRecord[] }>(`/admin/audit-logs${query}`),
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
  profile: string
  status: "Ativo" | "Inativo"
  initials: string
  course: string | null
  lastAccess: string | null
}

export interface AuditRecord {
  id: string
  timestamp: string
  actor: string
  role: string
  action: string
  entityType: string
  entityId: string
  origin: string
  hash: string
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
