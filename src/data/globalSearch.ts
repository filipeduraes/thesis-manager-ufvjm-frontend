import { adminApi, defenseApi, directoryApi, publicSearchApi, thesesApi } from "../api/client"
import type { NavigationItem, Page } from "../types"

export type SearchDestination =
  | { kind: "page"; page: Page; query?: string; departmentId?: string }
  | { kind: "thesis" | "authoredThesis" | "committee" | "evaluation" | "publication"; id: string }
  | { kind: "person"; email?: string }

export interface SearchResult {
  id: string
  title: string
  subtitle?: string
  destination: SearchDestination
  personSummary?: { email?: string; subtitle?: string }
}

interface SearchSource {
  label: string
  people?: boolean
  acceptsEmail?: boolean
  cacheable?: boolean
  search: (query: string, signal: AbortSignal) => Promise<SearchResult[]>
}

const LIMIT = 5

const shortcuts: Partial<Record<Page, string[]>> = {
  dashboard: ["Painel inicial", "Dashboard"],
  submission: ["Enviar PDF", "Criar rascunho", "Acompanhar submissão", "Documentos complementares"],
  approval: ["Revisar monografia", "Aprovar TCC", "Emitir parecer", "Orientação"],
  schedule: ["Agendar banca", "Gerenciar defesa", "Confirmar disponibilidade", "Minha avaliação"],
  repository: ["Pesquisar publicações", "Baixar monografia", "Acervo de TCC"],
  reports: ["Exportar relatório em PDF", "Taxa de aprovação", "Indicadores", "Tempo médio até a defesa"],
  users: ["Cadastrar usuário", "Alunos", "Professores", "Orientadores", "Convites externos"],
  courses: ["Cadastrar curso", "Departamentos", "Coordenação"],
  audit: ["Histórico de alterações", "Exportar auditoria", "Registros administrativos"],
  style: ["Componentes", "Identidade visual"],
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

/** Matches menu destinations and their task labels without querying the API. */
export function searchShortcuts(menu: NavigationItem[], query: string): SearchResult[] {
  const term = normalize(query)
  return menu.flatMap(({ page, label }) => {
    const match = shortcuts[page]?.find((shortcut) => normalize(shortcut).includes(term))
    if (term && !normalize(label).includes(term) && !match) return []
    return [{
      id: page,
      title: label,
      subtitle: term ? match : undefined,
      destination: { kind: "page", page } as const,
    }]
  }).slice(0, LIMIT)
}

function adminQuery(query: string, field = "q"): string {
  return `?${new URLSearchParams({ [field]: query, page_size: String(LIMIT) })}`
}

function thesisSource(scope?: "authored"): SearchSource {
  return {
    label: "Monografias",
    async search(query, signal) {
      const { results } = await thesesApi.list({ q: query, scope, pageSize: LIMIT }, signal)
      return results.map(({ id, title, referenceCode }) => ({
        id, title, subtitle: referenceCode, destination: { kind: scope ? "authoredThesis" : "thesis", id },
      }))
    },
  }
}

const defenses: SearchSource = {
  label: "Bancas",
  async search(query, signal) {
    const { results } = await defenseApi.list({ q: query, pageSize: LIMIT }, signal)
    return results.map((defense) => ({
      id: defense.id,
      title: defense.thesisTitle,
      subtitle: defense.statusLabel,
      destination: {
        kind: defense.viewerMembership?.canEvaluate ? "evaluation" : "committee",
        id: defense.id,
      },
    }))
  },
}

const publications: SearchSource = {
  label: "Publicações",
  cacheable: true,
  async search(query, signal) {
    const { results } = await publicSearchApi.theses(query, LIMIT, signal)
    return results.map(({ id, title, course }) => ({
      id, title, subtitle: course.name, destination: { kind: "publication", id },
    }))
  },
}

const advisors: SearchSource = {
  label: "Orientadores",
  people: true,
  cacheable: true,
  async search(query, signal) {
    const { results } = await publicSearchApi.advisors(query, LIMIT, signal)
    return results.map(({ id, name }) => ({
      id, title: name, subtitle: "Orientador", destination: { kind: "person" },
    }))
  },
}

const roleLabels: Record<string, string> = {
  STUDENT: "Aluno", ADVISOR: "Orientador", COORDINATOR: "Coordenador", ADMIN: "Administrador",
}

const directory: SearchSource = {
  label: "Pessoas",
  people: true,
  acceptsEmail: true,
  async search(query, signal) {
    const { results } = await directoryApi.users(query, LIMIT, signal)
    return results.map(({ id, name, roles, email }) => ({
      id,
      title: name,
      subtitle: roles.map((role) => roleLabels[role]).filter(Boolean).join(", "),
      destination: { kind: "person", email },
    }))
  },
}

const adminUsers: SearchSource = {
  label: "Usuários",
  people: true,
  acceptsEmail: true,
  async search(query, signal) {
    const { results } = await adminApi.users(adminQuery(query, "search"), signal)
    return results.map(({ id, name, role, email }) => ({
      id, title: name, subtitle: role, destination: { kind: "page", page: "users", query: email },
    }))
  },
}

const courses: SearchSource = {
  label: "Cursos",
  async search(query, signal) {
    const { results } = await adminApi.courses(adminQuery(query), signal)
    return results.map(({ id, name, code }) => ({
      id, title: name, subtitle: code, destination: { kind: "page", page: "courses", query: code },
    }))
  },
}

const departments: SearchSource = {
  label: "Departamentos",
  async search(query, signal) {
    const { results } = await adminApi.departments(`?${new URLSearchParams({ q: query })}`, signal)
    return results.slice(0, LIMIT).map(({ id, name }) => ({
      id, title: name, destination: { kind: "page", page: "courses", departmentId: id },
    }))
  },
}

/** Selects API sources that have a corresponding destination in the current session. */
export function searchSources(menu: NavigationItem[], canReadDirectory: boolean): SearchSource[] {
  const hasPage = (page: Page) => menu.some((item) => item.page === page)
  const sources = [thesisSource(hasPage("submission") ? "authored" : undefined)]
  if (hasPage("schedule")) sources.push(defenses)
  sources.push(publications)
  if (hasPage("users")) sources.push(adminUsers)
  if (canReadDirectory) sources.push(directory)
  sources.push(advisors)
  if (hasPage("courses")) sources.push(courses, departments)
  return sources
}
