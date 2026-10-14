import type { NavigationItem, Profile } from "../types"

export const profiles: Profile[] = [
  "Aluno",
  "Orientador",
  "Coordenador",
  "Administrador",
]

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
