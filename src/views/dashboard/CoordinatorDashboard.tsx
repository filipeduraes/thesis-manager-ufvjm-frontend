import { useMemo } from "react"
import {
  defenseApi,
  reportsApi,
  type DefenseListItem,
  type PaginatedResponse,
  type ReportsOverview,
  type ThesisListItem,
} from "../../api/client"
import LazyChart from "../../components/charts/LazyChart"
import { Badge, Button, Card, Icon, Kpi } from "../../components/common"
import { defenseResultsByYear, RESULT_COLOR_TOKENS } from "../../data/reportCharts"
import { APPROVAL_RATE_LABEL, formatCount, formatDays, formatRate } from "../../data/reportFormat"
import { formatDate, formatDateTime } from "../../data/thesisStatus"
import { loadErrorMessage, useAsyncData } from "../../hooks/useAsyncData"
import type { Page } from "../../types"
import DashboardError from "./DashboardError"
import DashboardLoading from "./DashboardLoading"

const LIST_SIZE = 5

interface CoordinatorDashboardData {
  overview: ReportsOverview
  schedulable: PaginatedResponse<ThesisListItem>
  scheduled: PaginatedResponse<DefenseListItem>
}

async function loadCoordinatorDashboard(): Promise<CoordinatorDashboardData> {
  // scope=coordinated: um administrador que também coordena vê aqui só os próprios cursos.
  const [overview, schedulable, scheduled] = await Promise.all([
    reportsApi.overview({ scope: "coordinated" }),
    defenseApi.schedulableTheses({ pageSize: LIST_SIZE }),
    defenseApi.list({ status: "SCHEDULED", pageSize: LIST_SIZE }),
  ])
  return { overview, schedulable, scheduled }
}

interface CoordinatorDashboardProps {
  go: (page: Page) => void
}

export default function CoordinatorDashboard({ go }: CoordinatorDashboardProps) {
  const dashboard = useAsyncData(loadCoordinatorDashboard)
  const yearChart = useMemo(
    () => defenseResultsByYear(dashboard.value?.overview.byDefenseYear ?? []),
    [dashboard.value],
  )

  if (dashboard.status === "loading" && !dashboard.value) {
    return <DashboardLoading icon="chart" title="Carregando painel da coordenação…" description="Buscando indicadores e bancas dos seus cursos." />
  }
  if (dashboard.status === "error" || !dashboard.value) {
    const message = loadErrorMessage(dashboard.error, "Não foi possível carregar o painel da coordenação.")
    return <DashboardError title="Não foi possível carregar o painel da coordenação" message={message} onRetry={dashboard.reload} />
  }

  const { overview, schedulable, scheduled } = dashboard.value
  const { summary } = overview

  return (
    <>
      {overview.options.courses.length === 0 && (
        <p className="scope-note" role="note">
          Nenhum curso está vinculado à sua coordenação. Peça a um administrador para associar seus cursos.
        </p>
      )}
      <div className="kpi-grid four">
        <Kpi label="Monografias em andamento" value={formatCount(summary.inProgressCount)} meta={`${formatCount(summary.thesisCount)} no total`} icon="file" />
        <Kpi label={APPROVAL_RATE_LABEL} value={formatRate(summary.approvalRate)} meta={`${formatCount(summary.completedDefenseCount)} bancas concluídas`} icon="check" />
        <Kpi label="Submissão até a defesa" value={formatDays(summary.averageSubmissionToDefenseDays)} meta="Média por banca concluída" icon="clock" />
        <Kpi label="Bancas agendadas" value={formatCount(summary.scheduledDefenseCount)} meta={`${formatCount(schedulable.count)} aguardando agendamento`} icon="calendar" />
      </div>

      <div className="dashboard-columns">
        <Card>
          <div className="section-head">
            <div>
              <p className="eyebrow">Operação de bancas</p>
              <h2>Aguardando agendamento</h2>
            </div>
            <Badge tone="light">{`${formatCount(schedulable.count)} trabalho(s)`}</Badge>
          </div>
          {schedulable.results.length === 0 ? (
            <div className="empty-state compact">
              <div>
                <Icon name="check" />
              </div>
              <h3>Nenhuma monografia aguardando banca</h3>
              <p>As monografias aprovadas pelo orientador aparecerão aqui.</p>
            </div>
          ) : (
            <div className="operation-list">
              {schedulable.results.map((thesis) => (
                <div key={thesis.id}>
                  <div>
                    <strong>{thesis.student?.name ?? thesis.title}</strong>
                    <span>
                      {thesis.course.name} · aprovada em {formatDate(thesis.advisorApprovedAt)}
                    </span>
                  </div>
                  <Button variant="outline" onClick={() => go("schedule")}>
                    Agendar banca
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="section-head">
            <div>
              <p className="eyebrow">Agenda</p>
              <h2>Bancas agendadas</h2>
            </div>
            <button className="text-link" onClick={() => go("schedule")}>
              Ver bancas
            </button>
          </div>
          {scheduled.results.length === 0 ? (
            <div className="empty-state compact">
              <div>
                <Icon name="calendar" />
              </div>
              <h3>Nenhuma banca agendada</h3>
              <p>As bancas marcadas aparecerão aqui.</p>
            </div>
          ) : (
            <div className="operation-list">
              {scheduled.results.map((defense) => (
                <div key={defense.id}>
                  <div>
                    <strong>{defense.thesisTitle}</strong>
                    <span>
                      {formatDateTime(defense.scheduledDatetime)} · {defense.modalityLabel}
                      {defense.student ? ` · ${defense.student.name}` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="section-head">
          <div>
            <p className="eyebrow">Série histórica</p>
            <h2>Resultados das bancas por ano</h2>
          </div>
          <button className="text-link" onClick={() => go("reports")}>
            Ver relatórios
          </button>
        </div>
        {yearChart.labels.length === 0 ? (
          <div className="empty-state compact">
            <div>
              <Icon name="chart" />
            </div>
            <h3>Ainda não há bancas concluídas</h3>
            <p>O gráfico aparece quando as primeiras bancas dos seus cursos forem encerradas.</p>
          </div>
        ) : (
          <LazyChart kind="bar" title="Resultados das bancas por ano de defesa" labels={yearChart.labels} series={yearChart.series} colorTokens={RESULT_COLOR_TOKENS} />
        )}
      </Card>
    </>
  )
}
