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

/** Ordering codes accepted by `GET /api/v1/public/theses`. */
export type RepositoryOrdering = "relevance" | "recent" | "title"

/** Search parameters of the public repository (`keyword` carries the normalized `value`). */
export interface PublicRepositorySearchParams {
  q?: string
  courseId?: string
  advisorId?: string
  year?: number
  keywords?: string[]
  ordering?: RepositoryOrdering
  page?: number
  pageSize?: number
}

/** Public author entry: no e-mail, `user` is null for authors without an account. */
export interface PublicRepositoryAuthor {
  id: string
  position: number
  isMainAuthor: boolean
  name: string
  user: { id: string; name: string } | null
}

/** Item of `GET /api/v1/public/theses` (`public_thesis_list_payload`). */
export interface PublicRepositoryThesis {
  id: string
  referenceCode: string
  type: "MONOGRAPH" | "ARTICLE"
  typeLabel: string
  title: string
  abstract: string
  journal: string
  origin: "WORKFLOW" | "LEGACY_IMPORT"
  course: { id: string; name: string; code: string }
  advisor: { id: string; name: string } | null
  authors: PublicRepositoryAuthor[]
  authorNames: string[]
  keywords: string[]
  publishedAt: string | null
  defenseDate: string | null
  defenseYear: number | null
  currentFile: {
    id: string
    versionNumber: number
    originalFilename: string
    sizeBytes: number
    sha256: string
    downloadUrl: string
    previewUrl: string
  } | null
}

/** SHA-256 of the published PDF exposed by the public detail. */
export interface PublicRepositoryIntegrity {
  algorithm: string
  sha256: string
  sizeBytes: number
  versionNumber: number
  hashVerifiedAt: string | null
}

/** `GET /api/v1/public/theses/<id>` (`public_thesis_detail_payload`). */
export interface PublicRepositoryThesisDetail extends Omit<PublicRepositoryThesis, "currentFile"> {
  currentFile: { downloadUrl: string; previewUrl: string } | null
  integrity: PublicRepositoryIntegrity | null
  fileVersions: Array<{ versionNumber: number; isCurrent: boolean; sha256: string; sizeBytes: number; uploadedAt: string }>
}

/** `GET /api/v1/public/theses/filters`. */
export interface PublicRepositoryFilters {
  courses: Array<{ id: string; name: string; code: string; count: number }>
  advisors: Array<{ id: string; name: string; count: number }>
  years: Array<{ year: number; count: number }>
  keywords: Array<{ name: string; value: string; count: number }>
}

/** Author of a repository entry: a printed name, optionally linked to a user. */
export interface RepositoryAuthorInput {
  name?: string
  userId?: string
}

/** Metadata shared by `POST /theses/legacy` and `PATCH /theses/<id>/published`. */
export interface RepositoryMetadataInput {
  title: string
  abstract: string
  keywords: string[]
  authors: RepositoryAuthorInput[]
  advisorId: string
  courseId: string
  defenseYear: number
  defenseDate?: string | null
  type?: "MONOGRAPH" | "ARTICLE"
  journal?: string
}

/** Multipart body of `POST /api/v1/theses/legacy`. */
export interface LegacyThesisInput extends RepositoryMetadataInput {
  result: "APPROVED" | "APPROVED_WITH_REMARKS"
  file: File
}
