export type Page = "login" | "dashboard" | "submission" | "approval" | "schedule" | "evaluation" | "committee" | "repository" | "reports" | "users" | "courses" | "audit" | "style"

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
  courseId?: string
  lastAccess?: string
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


/** Committee role codes accepted by the defense member endpoints. */
export type CommitteeRoleCode = "PRESIDENT" | "MEMBER" | "ALTERNATE"

/** Defense modality codes accepted by the scheduling endpoint. */
export type DefenseModalityCode = "IN_PERSON" | "REMOTE"

/** Institutional committee member chosen in a form, before or after the defense exists. */
export interface InstitutionalMemberDraft {
  role: CommitteeRoleCode
  userId: string
  name: string
  email: string
  /** Foto da conta Google retornada pela busca de usuário, para o avatar do formulário. */
  avatarUrl: string | null
}

/** External committee member chosen in a form; the backend creates the invitation. */
export interface ExternalMemberDraft {
  role: CommitteeRoleCode
  name: string
  email: string
  institution: string
}

/**
 * Editable scheduling fields of a defense, kept as raw input strings.
 * `date` is `YYYY-MM-DD` and `startTime` is `HH:MM`, both in São Paulo wall-clock time.
 */
export interface DefenseScheduleDraft {
  date: string
  startTime: string
  /** Duration in minutes, as typed (validated before sending). */
  duration: string
  modality: DefenseModalityCode | null
  location: string
  notes: string
}
