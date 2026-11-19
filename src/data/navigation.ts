import type { NavigationItem, Profile } from "../types"

export const profiles: Profile[] = [
  "Aluno",
  "Orientador",
  "Coordenador",
  "Administrador",
]

/** Ordem dos cargos (mesma prioridade do backend): menu somado e seções da tela inicial. */
export const PROFILE_PRIORITY: Profile[] = ["Administrador", "Coordenador", "Orientador", "Aluno"]

export function profilesFromCodes(codes: Array<string | null | undefined>): Profile[] {
  const mapped = codes
    .map((code) => {
      if (code === "ADMIN") return "Administrador" as Profile
      if (code === "COORDINATOR") return "Coordenador" as Profile
      if (code === "ADVISOR") return "Orientador" as Profile
      if (code === "STUDENT") return "Aluno" as Profile
      return null
    })
    .filter((item): item is Profile => item !== null)
    .filter((item, index, list) => list.indexOf(item) === index)
  return PROFILE_PRIORITY.filter((item) => mapped.includes(item))
}

export function menuForProfiles(activeProfiles: Profile[]): NavigationItem[] {
  const ordered = PROFILE_PRIORITY.filter((item) => activeProfiles.includes(item))
  const seen = new Set<string>()
  const items: NavigationItem[] = []
  for (const profile of ordered.length > 0 ? ordered : ["Aluno" as Profile]) {
    for (const item of menuByProfile[profile]) {
      if (seen.has(item.page)) continue
      seen.add(item.page)
      items.push(item)
    }
  }
  return items
}

export const menuByProfile: Record<Profile, NavigationItem[]> = {
  Aluno: [
    { label: "Início", icon: "home", page: "dashboard" },
    { label: "Minha monografia", icon: "file", page: "submission" },
    { label: "Repositório", icon: "book", page: "repository" },
  ],
  Orientador: [
    { label: "Início", icon: "home", page: "dashboard" },
    { label: "Orientandos", icon: "users", page: "approval" },
    { label: "Bancas", icon: "calendar", page: "schedule" },
    { label: "Repositório", icon: "book", page: "repository" },
  ],
  Coordenador: [
    { label: "Início", icon: "home", page: "dashboard" },
    { label: "Bancas", icon: "calendar", page: "schedule" },
    { label: "Monografias", icon: "file", page: "approval" },
    { label: "Relatórios", icon: "chart", page: "reports" },
    { label: "Repositório", icon: "book", page: "repository" },
  ],
  Administrador: [
    { label: "Início", icon: "home", page: "dashboard" },
    { label: "Bancas", icon: "calendar", page: "schedule" },
    { label: "Monografias", icon: "file", page: "approval" },
    { label: "Relatórios", icon: "chart", page: "reports" },
    { label: "Usuários", icon: "users", page: "users" },
    { label: "Cursos", icon: "book", page: "courses" },
    { label: "Auditoria", icon: "clock", page: "audit" },
    { label: "Guia de estilo", icon: "file", page: "style" },
    { label: "Repositório", icon: "book", page: "repository" },
  ],
}
