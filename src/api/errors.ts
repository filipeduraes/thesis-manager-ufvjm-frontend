/** Extrai a mensagem amigável de qualquer falha de requisição. */
export function apiErrorMessage(error: unknown, fallback = "Não foi possível concluir a solicitação."): string {
  return error instanceof Error && error.message ? error.message : fallback
}

/** Normaliza o corpo de erro da API para uma única mensagem em texto. */
export function normalizeErrorBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback
  const record = body as Record<string, unknown>
  const detail = record.detail
  if (typeof detail === "string" && detail) return detail
  const values = Object.values(record).flat().filter((value) => typeof value === "string")
  return values.length > 0 ? values.join(" ") : fallback
}
