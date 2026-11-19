import type { ReportDefenseCounters, ReportsOverview, ReportSummary } from "../../api/client"

const EMPTY_DEFENSE_COUNTERS: ReportDefenseCounters = {
  completedDefenseCount: 0,
  approvedCount: 0,
  approvedWithRemarksCount: 0,
  rejectedCount: 0,
  approvalRate: null,
  averageSubmissionToDefenseDays: null,
}

const EMPTY_SUMMARY: ReportSummary = {
  thesisCount: 0,
  inProgressCount: 0,
  publishedCount: 0,
  scheduledDefenseCount: 0,
  ...EMPTY_DEFENSE_COUNTERS,
}

/** Builds a `GET /reports/overview` response for tests; defaults to an empty report with no options. */
export function buildReportsOverview(overrides: Partial<ReportsOverview> = {}): ReportsOverview {
  return {
    scope: "ALL",
    filters: { courseId: null, advisorId: null, year: null },
    summary: EMPTY_SUMMARY,
    byCourse: [],
    byAdvisor: [],
    byDefenseYear: [],
    options: { courses: [], advisors: [], years: [] },
    ...overrides,
  }
}

/** A populated report: two courses, two advisors and defenses in 2025 and 2026. */
export function populatedReportsOverview(scope: ReportsOverview["scope"] = "ALL"): ReportsOverview {
  return buildReportsOverview({
    scope,
    summary: {
      thesisCount: 12,
      inProgressCount: 7,
      publishedCount: 2,
      scheduledDefenseCount: 3,
      completedDefenseCount: 8,
      approvedCount: 5,
      approvedWithRemarksCount: 2,
      rejectedCount: 1,
      approvalRate: 0.875,
      averageSubmissionToDefenseDays: 61.5,
    },
    byCourse: [
      { courseId: "course-cc", courseCode: "CC", courseName: "Ciência da Computação", thesisCount: 8, inProgressCount: 5, publishedCount: 1, ...EMPTY_DEFENSE_COUNTERS, completedDefenseCount: 6, approvedCount: 4, approvedWithRemarksCount: 1, rejectedCount: 1, approvalRate: 0.8333, averageSubmissionToDefenseDays: 58 },
      { courseId: "course-si", courseCode: "SI", courseName: "Sistemas de Informação", thesisCount: 4, inProgressCount: 2, publishedCount: 1, ...EMPTY_DEFENSE_COUNTERS },
    ],
    byAdvisor: [
      { advisorId: "advisor-ana", advisorName: "Ana Orientadora", thesisCount: 7, inProgressCount: 4, publishedCount: 1, ...EMPTY_DEFENSE_COUNTERS },
      { advisorId: "advisor-bruno", advisorName: "Bruno Orientador", thesisCount: 5, inProgressCount: 3, publishedCount: 1, ...EMPTY_DEFENSE_COUNTERS },
    ],
    byDefenseYear: [
      { year: 2025, ...EMPTY_DEFENSE_COUNTERS, completedDefenseCount: 5, approvedCount: 3, approvedWithRemarksCount: 1, rejectedCount: 1, approvalRate: 0.8, averageSubmissionToDefenseDays: 64 },
      { year: 2026, ...EMPTY_DEFENSE_COUNTERS, completedDefenseCount: 3, approvedCount: 2, approvedWithRemarksCount: 1, approvalRate: 1, averageSubmissionToDefenseDays: 57.3 },
    ],
    options: {
      courses: [
        { id: "course-cc", code: "CC", name: "Ciência da Computação" },
        { id: "course-si", code: "SI", name: "Sistemas de Informação" },
      ],
      advisors: [
        { id: "advisor-ana", name: "Ana Orientadora" },
        { id: "advisor-bruno", name: "Bruno Orientador" },
      ],
      years: [2025, 2026],
    },
  })
}
