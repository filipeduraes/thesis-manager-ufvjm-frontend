import type { ReportAdvisorRow, ReportCourseRow, ReportSummary, ReportYearRow } from "../api/client"
import type { ChartSeries } from "../components/charts/ChartCanvas"

export interface ChartData {
  labels: string[]
  series: ChartSeries[]
}

/** Resultados das bancas: azul-marinho para aprovadas, sálvia para com ressalvas, vermelho para reprovadas. */
export const RESULT_COLOR_TOKENS = ["--navy", "--sage", "--danger"]

/** Per-year defense results, as returned by `byDefenseYear` (no client-side aggregation). */
export function defenseResultsByYear(rows: ReportYearRow[]): ChartData {
  return {
    labels: rows.map((row) => String(row.year)),
    series: [
      { label: "Aprovadas", values: rows.map((row) => row.approvedCount) },
      { label: "Com ressalvas", values: rows.map((row) => row.approvedWithRemarksCount) },
      { label: "Reprovadas", values: rows.map((row) => row.rejectedCount) },
    ],
  }
}

/** Completed defenses per year, as returned by `byDefenseYear`. */
export function completedDefensesByYear(rows: ReportYearRow[]): ChartData {
  return {
    labels: rows.map((row) => String(row.year)),
    series: [{ label: "Bancas concluídas", values: rows.map((row) => row.completedDefenseCount) }],
  }
}

/** Theses per course (course code as label), as returned by `byCourse`. */
export function thesesByCourse(rows: ReportCourseRow[]): ChartData {
  return {
    labels: rows.map((row) => row.courseCode),
    series: [{ label: "Monografias", values: rows.map((row) => row.thesisCount) }],
  }
}

/** Theses per advisor, keeping the backend order (most theses first) and at most `limit` rows. */
export function thesesByAdvisor(rows: ReportAdvisorRow[], limit: number): ChartData {
  const visibleRows = rows.slice(0, limit)
  return {
    labels: visibleRows.map((row) => row.advisorName),
    series: [{ label: "Monografias", values: visibleRows.map((row) => row.thesisCount) }],
  }
}

/** Defense result breakdown of the summary for a doughnut chart. */
export function defenseResultBreakdown(summary: ReportSummary): ChartData {
  return {
    labels: ["Aprovadas", "Com ressalvas", "Reprovadas"],
    series: [{ label: "Bancas", values: [summary.approvedCount, summary.approvedWithRemarksCount, summary.rejectedCount] }],
  }
}
