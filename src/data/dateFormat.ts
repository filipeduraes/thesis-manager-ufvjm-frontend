/** Formatadores de data compartilhados pelas telas de banca. */

export const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
})

const DATE_ONLY_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
})

/**
 * Formats a calendar date without time (`YYYY-MM-DD`), such as a defense date.
 *
 * The value has no time zone, so it is read and printed in UTC to avoid
 * moving it to the previous day in São Paulo.
 */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "—"
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? "—" : DATE_ONLY_FORMATTER.format(parsed)
}

/** Today's date (`YYYY-MM-DD`) in the America/Sao_Paulo time zone. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(now)
}
