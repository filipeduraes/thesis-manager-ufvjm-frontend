import { ApiError, type Thesis, type UserSuggestion } from "../../api/client"
import { apiErrorMessage } from "../../api/errors"
import { todayInSaoPaulo } from "../../data/dateFormat"
import type { RepositoryAuthorInput, RepositoryMetadataInput } from "../../types"

/** Limites espelhados do backend (`THESIS_MAX_AUTHORS`, `MIN_DEFENSE_YEAR`, `THESIS_MAX_PDF_SIZE_MB`). */
export const REPOSITORY_MAX_AUTHORS = 5
export const REPOSITORY_MIN_DEFENSE_YEAR = 1950
export const REPOSITORY_MAX_PDF_SIZE_MB = 50
export const REPOSITORY_MAX_REASON_LENGTH = 1000

export type RepositoryThesisType = "MONOGRAPH" | "ARTICLE"

export const THESIS_TYPE_OPTIONS: Array<{ value: RepositoryThesisType; label: string }> = [
  { value: "MONOGRAPH", label: "Monografia" },
  { value: "ARTICLE", label: "Artigo" },
]

export const LEGACY_RESULT_OPTIONS = [
  { value: "APPROVED", label: "Aprovada" },
  { value: "APPROVED_WITH_REMARKS", label: "Aprovada com ressalvas" },
] as const

/** Selected person (advisor or linked author) shown in the form. */
export interface RepositoryPerson {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

/** One author row: a printed name, optionally linked to an institutional user. */
export interface RepositoryAuthorDraft {
  key: string
  name: string
  user: RepositoryPerson | null
}

/** Raw input of the repository metadata form, kept as typed strings. */
export interface RepositoryMetadataDraft {
  title: string
  abstract: string
  /** Palavras-chave separadas por vírgula ou ponto e vírgula. */
  keywords: string
  authors: RepositoryAuthorDraft[]
  advisorQuery: string
  advisor: RepositoryPerson | null
  courseId: string
  defenseYear: string
  /** `YYYY-MM-DD` ou vazio. */
  defenseDate: string
  type: RepositoryThesisType
  journal: string
}

/** Creates an author row with a unique key for list rendering. */
export function newAuthorDraft(name = "", user: RepositoryPerson | null = null): RepositoryAuthorDraft {
  return { key: `author-${Date.now()}-${Math.random().toString(36).slice(2)}`, name, user }
}

/** Empty draft for the legacy registration form. */
export function emptyRepositoryDraft(): RepositoryMetadataDraft {
  return {
    title: "",
    abstract: "",
    keywords: "",
    authors: [newAuthorDraft()],
    advisorQuery: "",
    advisor: null,
    courseId: "",
    defenseYear: "",
    defenseDate: "",
    type: "MONOGRAPH",
    journal: "",
  }
}

/** Converts an autocomplete suggestion into the person kept by the form. */
export function personFromSuggestion(user: UserSuggestion): RepositoryPerson {
  return { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl }
}

/** Builds the edit draft from the internal thesis payload (authors in position order). */
export function draftFromThesis(thesis: Thesis): RepositoryMetadataDraft {
  const authors = [...thesis.authors]
    .sort((first, second) => first.position - second.position)
    .map((author) => {
      const user = author.user ? { ...author.user, avatarUrl: null } : null
      return newAuthorDraft(author.name || author.user?.name || "", user)
    })
  const fallbackYear = thesis.publishedAt ? todayInSaoPaulo(new Date(thesis.publishedAt)).slice(0, 4) : ""
  return {
    title: thesis.title,
    abstract: thesis.abstract,
    keywords: thesis.keywords.join(", "),
    authors: authors.length > 0 ? authors : [newAuthorDraft()],
    advisorQuery: thesis.advisor?.name ?? "",
    advisor: thesis.advisor ? { ...thesis.advisor, avatarUrl: null } : null,
    courseId: thesis.course.id,
    defenseYear: thesis.defenseYear ? String(thesis.defenseYear) : fallbackYear,
    defenseDate: thesis.defenseDate ?? "",
    type: thesis.type === "ARTICLE" ? "ARTICLE" : "MONOGRAPH",
    journal: thesis.journal ?? "",
  }
}

function parseKeywords(raw: string): string[] {
  const seen = new Set<string>()
  const keywords: string[] = []
  for (const part of raw.split(/[,;]/)) {
    const keyword = part.split(/\s+/).filter(Boolean).join(" ")
    const normalized = keyword.toLocaleLowerCase("pt-BR")
    if (!keyword || seen.has(normalized)) continue
    seen.add(normalized)
    keywords.push(keyword)
  }
  return keywords
}

function collapse(value: string): string {
  return value.split(/\s+/).filter(Boolean).join(" ")
}

/**
 * Validates the draft before sending, mirroring the backend rules for fast feedback.
 *
 * The backend validates again and its message is always shown.
 *
 * @returns A Portuguese message describing the first problem, or an empty string.
 */
export function validateRepositoryDraft(draft: RepositoryMetadataDraft, today: string = todayInSaoPaulo()): string {
  if (!collapse(draft.title)) return "Informe o título da monografia."
  if (!draft.abstract.trim()) return "Informe o resumo da monografia."
  if (parseKeywords(draft.keywords).length === 0) return "Informe pelo menos uma palavra-chave."
  if (draft.authors.length === 0) return "Informe pelo menos um autor."
  if (draft.authors.length > REPOSITORY_MAX_AUTHORS) return `Informe no máximo ${REPOSITORY_MAX_AUTHORS} autores.`
  const names = new Set<string>()
  for (const author of draft.authors) {
    const name = collapse(author.name) || author.user?.name || ""
    if (!name) return "Informe o nome de cada autor."
    const normalized = name.toLocaleLowerCase("pt-BR")
    if (names.has(normalized)) return "O mesmo autor foi informado mais de uma vez."
    names.add(normalized)
  }
  if (!draft.advisor) return "Selecione o orientador na lista de sugestões."
  if (!draft.courseId) return "Selecione o curso."
  const currentYear = Number(today.slice(0, 4))
  const year = Number(draft.defenseYear)
  if (!Number.isInteger(year) || year < REPOSITORY_MIN_DEFENSE_YEAR || year > currentYear) {
    return `Informe um ano de defesa entre ${REPOSITORY_MIN_DEFENSE_YEAR} e ${currentYear}.`
  }
  if (draft.defenseDate) {
    if (draft.defenseDate > today) return "A data de defesa não pode estar no futuro."
    if (Number(draft.defenseDate.slice(0, 4)) !== year) return "A data de defesa não corresponde ao ano informado."
  }
  return ""
}

function authorInput(author: RepositoryAuthorDraft): RepositoryAuthorInput {
  const name = collapse(author.name)
  if (author.user) return name ? { userId: author.user.id, name } : { userId: author.user.id }
  return { name }
}

/** Converts a validated draft into the API payload (codes and ISO dates only). */
export function draftToMetadata(draft: RepositoryMetadataDraft): RepositoryMetadataInput {
  return {
    title: collapse(draft.title),
    abstract: draft.abstract.trim(),
    keywords: parseKeywords(draft.keywords),
    authors: draft.authors.map(authorInput),
    advisorId: draft.advisor?.id ?? "",
    courseId: draft.courseId,
    defenseYear: Number(draft.defenseYear),
    defenseDate: draft.defenseDate || null,
    type: draft.type,
    journal: draft.type === "ARTICLE" ? draft.journal.trim() : "",
  }
}

function sameValue(first: unknown, second: unknown): boolean {
  return JSON.stringify(first) === JSON.stringify(second)
}

/**
 * Returns only the fields that differ between the initial and the edited metadata,
 * so `PATCH /theses/<id>/published` records exactly what changed.
 */
export function changedMetadata(
  initial: RepositoryMetadataInput,
  next: RepositoryMetadataInput,
): Partial<RepositoryMetadataInput> {
  const changes: Partial<RepositoryMetadataInput> = {}
  const keys = Object.keys(next) as Array<keyof RepositoryMetadataInput>
  for (const key of keys) {
    const before = key === "keywords" ? [...initial.keywords].map((item) => item.toLocaleLowerCase("pt-BR")).sort() : initial[key]
    const after = key === "keywords" ? [...next.keywords].map((item) => item.toLocaleLowerCase("pt-BR")).sort() : next[key]
    if (!sameValue(before ?? null, after ?? null)) Object.assign(changes, { [key]: next[key] })
  }
  return changes
}

/**
 * Friendly message for a failed repository management request.
 *
 * 429 asks the user to wait; 403 and 400 keep the backend message (already in Portuguese).
 */
export function repositoryErrorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof ApiError && reason.status === 429) {
    return "Muitas solicitações em pouco tempo. Aguarde alguns instantes e tente novamente."
  }
  if (reason instanceof ApiError && reason.status === 401) {
    return "Sua sessão expirou. Entre novamente para continuar."
  }
  return apiErrorMessage(reason, fallback)
}

/** Name of the main author, falling back to the first author or the linked student. */
export function mainAuthorName(thesis: Thesis): string {
  const main = thesis.authors.find((author) => author.isMainAuthor) ?? thesis.authors[0]
  return main?.name || main?.user?.name || thesis.student?.name || "Aluno"
}
