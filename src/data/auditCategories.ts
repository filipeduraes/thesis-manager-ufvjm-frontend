/** Categorias de verbosidade da auditoria e suas cores na paleta institucional. */

export const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "access", label: "Acesso" },
  { value: "management", label: "Gestão" },
  { value: "thesis", label: "Monografia e defesa" },
  { value: "publication", label: "Publicação" },
  { value: "error", label: "Erro" },
]

export const ALL_CATEGORIES = CATEGORY_OPTIONS.map((option) => option.value)

export const CATEGORY_COLORS: Record<string, string> = {
  access: "var(--slate)",
  management: "var(--navy)",
  thesis: "var(--sage)",
  publication: "var(--green)",
  error: "var(--danger)",
}
