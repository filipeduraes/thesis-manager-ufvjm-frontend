export type Page = "login" | "dashboard" | "submission" | "approval" | "schedule" | "evaluation" | "repository" | "reports" | "users" | "courses" | "audit" | "style"

export type Profile = "Aluno" | "Orientador" | "Coordenador" | "Administrador"

export interface NavigationItem {
  label: string
  icon: string
  page: Page
}

export interface User {
  id: string
  name: string
  email: string
  role: Profile
  affiliation: string
  status: "Ativo" | "Inativo"
  initials?: string
  course?: string
  lastAccess?: string
}

export interface Thesis {
  id: string
  title: string
  student: string
  course: string
  advisor: string
  status: string
  version: string
}

export interface Defense {
  id: string
  thesisId: string
  date: string
  time: string
  location: string
  mode: "Presencial" | "Remota"
}

export interface PresentedDefense {
  id: string
  thesis: string
  student: string
  course: string
  date: string
  role: string
  evaluated: boolean
}

export interface AuditLog {
  timestamp: string
  actor: string
  role: string
  action: string
  entityId: string
  origin: string
  hash: string
}

export interface Course {
  name: string
  code: string
  coordinator: string
  activeStudents: number
  publishedTheses: number
}

export interface RepositoryWork {
  title: string
  author: string
  advisor: string
  course: string
  type: "Monografia" | "Artigo"
  journal?: string
  year: string
  abstract: string
  tags: string[]
  uri: string
  doi: string
}

export interface AdvisorSubmission {
  student: string
  title: string
  course: string
  submittedAt: string
  status: string
  version: string
}

export interface CommitteeMember {
  initials: string
  name: string
  role: string
  status: "Confirmado" | "Pendente"
}
