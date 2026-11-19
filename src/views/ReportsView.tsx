import { useCallback, useMemo, useRef, useState } from "react"
import { ApiError, reportsApi, type ReportsOverview, type ReportsOverviewParams } from "../api/client"
import ChartCanvas from "../components/charts/ChartCanvas"
import { Button, Card, Icon, Kpi, PageTitle, SelectField } from "../components/common"
import {
  completedDefensesByYear,
  defenseResultBreakdown,
  RESULT_COLOR_TOKENS,
  thesesByAdvisor,
  thesesByCourse,
} from "../data/reportCharts"
import { APPROVAL_RATE_LABEL, formatCount, formatDays, formatRate } from "../data/reportFormat"
import { loadErrorMessage, useAsyncData } from "../hooks/useAsyncData"
import DashboardError from "./dashboard/DashboardError"
import DashboardLoading from "./dashboard/DashboardLoading"

const ADVISOR_CHART_LIMIT = 10

interface ReportFilterValues {
  courseId: string
  advisorId: string
  year: string
}

const EMPTY_FILTERS: ReportFilterValues = { courseId: "", advisorId: "", year: "" }

function toOverviewParams(filters: ReportFilterValues): ReportsOverviewParams {
  return {
    courseId: filters.courseId || undefined,
    advisorId: filters.advisorId || undefined,
    year: filters.year ? Number(filters.year) : undefined,
  }
}

interface FilterOption {
  value: string
  label: string
}

interface ReportFilterOptions {
  courses: FilterOption[]
  advisors: FilterOption[]
  years: FilterOption[]
}

/** Maps a failed PDF export to a message in Portuguese (403, 429, expired session or generic). */
function exportErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Sua sessão expirou. Entre novamente para exportar o relatório."
    if (error.status === 403) return "Você não tem permissão para exportar estes relatórios."
    if (error.status === 429) return "Muitas exportações em pouco tempo. Aguarde um minuto e tente novamente."
  }
  return "Não foi possível gerar o PDF. Tente novamente."
}

function filterOptions(overview: ReportsOverview | undefined): ReportFilterOptions {
  const courses = overview?.options.courses ?? []
  const advisors = overview?.options.advisors ?? []
  const years = overview?.options.years ?? []
  return {
    courses: [{ value: "", label: "Todos os cursos" }, ...courses.map((course) => ({ value: course.id, label: `${course.code} · ${course.name}` }))],
    advisors: [{ value: "", label: "Todos os orientadores" }, ...advisors.map((advisor) => ({ value: advisor.id, label: advisor.name }))],
    years: [{ value: "", label: "Todos os anos" }, ...years.map((year) => ({ value: String(year), label: String(year) }))],
  }
}

/**
 * Coordinator and administrator reports (`GET /api/v1/reports/overview`).
 * Loaded with `React.lazy` from `App.tsx`, so Chart.js only ships with this screen and the dashboards.
 */
export default function ReportsView() {
  const [filters, setFilters] = useState<ReportFilterValues>(EMPTY_FILTERS)
  const loadOverview = useCallback(() => reportsApi.overview(toOverviewParams(filters)), [filters])
  const report = useAsyncData(loadOverview)
  const overview = report.value
  const options = useMemo(() => filterOptions(overview), [overview])
  const charts = useMemo(() => {
    if (!overview) return null
    return {
      byCourse: thesesByCourse(overview.byCourse),
      results: defenseResultBreakdown(overview.summary),
      byYear: completedDefensesByYear(overview.byDefenseYear),
      byAdvisor: thesesByAdvisor(overview.byAdvisor, ADVISOR_CHART_LIMIT),
    }
  }, [overview])

  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState("")
  // O ref bloqueia um segundo clique que chegue antes de o botão ser re-renderizado como desabilitado.
  const exportInFlight = useRef(false)

  const exportReportPdf = async () => {
    if (exportInFlight.current) return
    exportInFlight.current = true
    setIsExporting(true)
    setExportError("")
    try {
      await reportsApi.exportPdf(toOverviewParams(filters))
    } catch (error) {
      setExportError(exportErrorMessage(error))
    } finally {
      exportInFlight.current = false
      setIsExporting(false)
    }
  }

  const updateFilter = (field: keyof ReportFilterValues) => (value: string) => {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  if (report.status === "error") {
    const message = loadErrorMessage(report.error, "Não foi possível carregar os relatórios.")
    return (
      <div className="page-content">
        <DashboardError title="Não foi possível carregar os relatórios" message={message} onRetry={report.reload} />
      </div>
    )
  }

  if (!overview || !charts) {
    return (
      <div className="page-content">
        <DashboardLoading icon="chart" title="Carregando relatórios…" description="Calculando indicadores no servidor." />
      </div>
    )
  }

  const { summary } = overview
  const hasFilters = filters.courseId !== "" || filters.advisorId !== "" || filters.year !== ""
  const isEmpty = summary.thesisCount === 0 && summary.completedDefenseCount === 0
  const statusMessages: string[] = []
  if (report.status === "loading") statusMessages.push("Atualizando indicadores…")
  if (isExporting) statusMessages.push("Gerando o PDF com os filtros atuais…")
  const scopeDescription =
    overview.scope === "ALL" ? "Dados de todos os cursos." : "Dados dos cursos que você coordena."

  return (
    <div className="page-content">
      <PageTitle eyebrow="Inteligência acadêmica" title="Relatórios e indicadores" subtitle={scopeDescription} />

      <Card className="report-filters">
        <SelectField label="Curso" options={options.courses} value={filters.courseId} onChange={updateFilter("courseId")} />
        <SelectField label="Orientador" options={options.advisors} value={filters.advisorId} onChange={updateFilter("advisorId")} />
        <SelectField label="Ano de defesa" options={options.years} value={filters.year} onChange={updateFilter("year")} />
        <Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)} disabled={!hasFilters}>
          Limpar filtros
        </Button>
        <Button variant="primary" icon="download" onClick={() => void exportReportPdf()} disabled={isExporting}>
          {isExporting ? "Gerando PDF…" : "Exportar PDF"}
        </Button>
      </Card>
      <p className="scope-note" role="status" aria-live="polite">
        {statusMessages.join(" ")}
      </p>
      {exportError ? (
        <div className="form-error" role="alert">
          {exportError}
        </div>
      ) : null}

      <div className="kpi-grid four">
        <Kpi label="Total de monografias" value={formatCount(summary.thesisCount)} meta={`${formatCount(summary.inProgressCount)} em andamento · ${formatCount(summary.publishedCount)} publicadas`} icon="file" />
        <Kpi label={APPROVAL_RATE_LABEL} value={formatRate(summary.approvalRate)} meta={`${formatCount(summary.rejectedCount)} reprovação(ões)`} icon="check" />
        <Kpi label="Submissão até a defesa" value={formatDays(summary.averageSubmissionToDefenseDays)} meta="Média por banca concluída" icon="clock" />
        <Kpi label="Bancas concluídas" value={formatCount(summary.completedDefenseCount)} meta={`${formatCount(summary.scheduledDefenseCount)} agendada(s)`} icon="calendar" />
      </div>

      {isEmpty ? (
        <Card>
          <div className="empty-state">
            <div>
              <Icon name="chart" />
            </div>
            <h2>Nenhum dado para os filtros selecionados</h2>
            <p>Altere os filtros ou aguarde as primeiras submissões e bancas.</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="charts-grid">
            <Card>
              <div className="section-head">
                <div>
                  <p className="eyebrow">Distribuição</p>
                  <h3>Monografias por curso</h3>
                </div>
              </div>
              <ChartCanvas kind="bar" title="Monografias por curso" labels={charts.byCourse.labels} series={charts.byCourse.series} />
            </Card>
            <Card>
              <div className="section-head">
                <div>
                  <p className="eyebrow">Resultados</p>
                  <h3>{APPROVAL_RATE_LABEL}</h3>
                </div>
              </div>
              {summary.approvalRate === null ? (
                <p className="scope-note">Ainda não há bancas concluídas com resultado.</p>
              ) : (
                <ChartCanvas kind="doughnut" title="Resultados das bancas concluídas" labels={charts.results.labels} series={charts.results.series} colorTokens={RESULT_COLOR_TOKENS} />
              )}
            </Card>
            <Card>
              <div className="section-head">
                <div>
                  <p className="eyebrow">Série histórica</p>
                  <h3>Bancas por ano de defesa</h3>
                </div>
              </div>
              {charts.byYear.labels.length === 0 ? (
                <p className="scope-note">Ainda não há bancas concluídas.</p>
              ) : (
                <ChartCanvas kind="line" title="Bancas concluídas por ano de defesa" labels={charts.byYear.labels} series={charts.byYear.series} />
              )}
            </Card>
            <Card>
              <div className="section-head">
                <div>
                  <p className="eyebrow">Orientação</p>
                  <h3>Monografias por orientador</h3>
                </div>
              </div>
              <ChartCanvas kind="horizontalBar" title={`Monografias por orientador (até ${ADVISOR_CHART_LIMIT})`} labels={charts.byAdvisor.labels} series={charts.byAdvisor.series} tall />
            </Card>
          </div>

          <Card>
            <div className="section-head">
              <div>
                <p className="eyebrow">Resumo</p>
                <h3>Indicadores por curso</h3>
              </div>
            </div>
            <div className="full-table compact" role="table" aria-label="Indicadores por curso">
              <div className="row head" role="row">
                <span role="columnheader">Curso</span>
                <span role="columnheader">Monografias</span>
                <span role="columnheader">{APPROVAL_RATE_LABEL}</span>
                <span role="columnheader">Tempo médio</span>
                <span role="columnheader">Bancas concluídas</span>
              </div>
              {overview.byCourse.map((course) => (
                <div className="row" role="row" key={course.courseId}>
                  <span role="cell">{course.courseName}</span>
                  <span role="cell">{formatCount(course.thesisCount)}</span>
                  <span role="cell">{formatRate(course.approvalRate)}</span>
                  <span role="cell">{formatDays(course.averageSubmissionToDefenseDays)}</span>
                  <span role="cell">{formatCount(course.completedDefenseCount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
