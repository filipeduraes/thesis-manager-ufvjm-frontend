import { buildAuditSummary } from "../../data/auditFormat"
import { useMemo } from "react"
import { adminApi, ApiError, reportsApi, type AuditRecord, type ReportsOverview } from "../../api/client"
import LazyChart from "../../components/charts/LazyChart"
import { Card, Icon, Kpi } from "../../components/common"
import { thesesByCourse } from "../../data/reportCharts"
import { APPROVAL_RATE_LABEL, formatCount, formatRate } from "../../data/reportFormat"
import { formatDateTime } from "../../data/thesisStatus"
import { loadErrorMessage, useAsyncData } from "../../hooks/useAsyncData"
import type { Page } from "../../types"
import DashboardError from "./DashboardError"
import DashboardLoading from "./DashboardLoading"

const AUDIT_PREVIEW_SIZE = 5
const UNAVAILABLE_META = "Indisponível neste acesso"

/** Resultado de uma área administrativa: o backend responde 404 fora da rede institucional. */
type AdminSection<T> =
  | { status: "ready"; value: T }
  | { status: "unavailable" }
  | { status: "error"; message: string }

interface AdminDashboardData {
  overview: ReportsOverview
  activeUsers: AdminSection<number>
  courses: AdminSection<number>
  auditLogs: AdminSection<AuditRecord[]>
}

async function settleAdminSection<T>(request: Promise<T>): Promise<AdminSection<T>> {
  try {
    const value = await request
    return { status: "ready", value }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { status: "unavailable" }
    return { status: "error", message: loadErrorMessage(error, "Não foi possível carregar estes dados.") }
  }
}

async function loadAdminDashboard(): Promise<AdminDashboardData> {
  const activeUsersRequest = adminApi.users("?status=Ativo&page_size=1").then((page) => page.count)
  const coursesRequest = adminApi.courses("?page_size=1").then((page) => page.count)
  const auditRequest = adminApi.auditLogs(`?page_size=${AUDIT_PREVIEW_SIZE}`).then((page) => page.results.slice(0, AUDIT_PREVIEW_SIZE))
  const [overview, activeUsers, courses, auditLogs] = await Promise.all([
    reportsApi.overview(),
    settleAdminSection(activeUsersRequest),
    settleAdminSection(coursesRequest),
    settleAdminSection(auditRequest),
  ])
  return { overview, activeUsers, courses, auditLogs }
}

function sectionCount(section: AdminSection<number>): string {
  return section.status === "ready" ? formatCount(section.value) : "—"
}

function sectionMeta(section: AdminSection<number>, readyMeta: string): string {
  if (section.status === "ready") return readyMeta
  if (section.status === "unavailable") return UNAVAILABLE_META
  return section.message
}

interface AdminDashboardProps {
  go: (page: Page) => void
}

export default function AdminDashboard({ go }: AdminDashboardProps) {
  const dashboard = useAsyncData(loadAdminDashboard)
  const courseChart = useMemo(() => thesesByCourse(dashboard.value?.overview.byCourse ?? []), [dashboard.value])

  if (dashboard.status === "loading" && !dashboard.value) {
    return <DashboardLoading icon="chart" title="Carregando painel administrativo…" description="Buscando indicadores, usuários e auditoria." />
  }
  if (dashboard.status === "error" || !dashboard.value) {
    const message = loadErrorMessage(dashboard.error, "Não foi possível carregar o painel administrativo.")
    return <DashboardError title="Não foi possível carregar o painel administrativo" message={message} onRetry={dashboard.reload} />
  }

  const { overview, activeUsers, courses, auditLogs } = dashboard.value
  const { summary } = overview

  return (
    <>
      <div className="kpi-grid four">
        <Kpi label="Usuários ativos" value={sectionCount(activeUsers)} meta={sectionMeta(activeUsers, "Contas institucionais")} icon="users" />
        <Kpi label="Cursos cadastrados" value={sectionCount(courses)} meta={sectionMeta(courses, "Cadastro acadêmico")} icon="book" />
        <Kpi label="Monografias" value={formatCount(summary.thesisCount)} meta={`${formatCount(summary.publishedCount)} publicadas`} icon="file" />
        <Kpi label={APPROVAL_RATE_LABEL} value={formatRate(summary.approvalRate)} meta={`${formatCount(summary.completedDefenseCount)} bancas concluídas`} icon="check" />
      </div>

      <div className="admin-dashboard">
        <Card>
          <div className="section-head">
            <div>
              <p className="eyebrow">Distribuição</p>
              <h2>Monografias por curso</h2>
            </div>
            <button className="text-link" onClick={() => go("reports")}>
              Ver relatórios
            </button>
          </div>
          {courseChart.labels.length === 0 ? (
            <div className="empty-state compact">
              <div>
                <Icon name="chart" />
              </div>
              <h3>Nenhuma monografia submetida</h3>
              <p>O gráfico aparece quando houver monografias fora de rascunho.</p>
            </div>
          ) : (
            <LazyChart kind="bar" title="Monografias por curso" labels={courseChart.labels} series={courseChart.series} />
          )}
        </Card>

        <Card>
          <div className="section-head">
            <div>
              <p className="eyebrow">Auditoria</p>
              <h2>Eventos recentes</h2>
            </div>
            {auditLogs.status === "ready" && (
              <button className="text-link" onClick={() => go("audit")}>
                Abrir auditoria
              </button>
            )}
          </div>
          {auditLogs.status === "unavailable" && <p className="scope-note">A auditoria não está disponível neste acesso.</p>}
          {auditLogs.status === "error" && (
            <p className="scope-note" role="alert">
              {auditLogs.message}
            </p>
          )}
          {auditLogs.status === "ready" && auditLogs.value.length === 0 && <p className="scope-note">Nenhum evento registrado.</p>}
          {auditLogs.status === "ready" && auditLogs.value.length > 0 && (
            <div className="operation-list">
              {auditLogs.value.map((record) => (
                <div key={record.id}>
                  <div>
                    <strong>{buildAuditSummary(record.event, record.summary || record.actionLabel || record.action)}</strong>
                    <span>
                      {formatDateTime(record.timestamp)} · {record.actor}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
