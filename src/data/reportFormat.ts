const NO_VALUE = "—"

const countFormatter = new Intl.NumberFormat("pt-BR")
const percentFormatter = new Intl.NumberFormat("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 })
const daysFormatter = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })

/** Formats an integer counter returned by the reports API (pt-BR grouping). */
export function formatCount(value: number): string {
  return countFormatter.format(value)
}

/**
 * Formats a 0–1 ratio from the reports API as a pt-BR percentage.
 * Returns an em dash when the backend sends `null` (no defense with a result).
 */
export function formatRate(rate: number | null): string {
  if (rate === null) return NO_VALUE
  return percentFormatter.format(rate)
}

/** Formats an average number of days, or an em dash when the backend sends `null`. */
export function formatDays(days: number | null): string {
  if (days === null) return NO_VALUE
  const formatted = daysFormatter.format(days)
  return days === 1 ? `${formatted} dia` : `${formatted} dias`
}

export const APPROVAL_RATE_LABEL = "Taxa de aprovação em bancas"
