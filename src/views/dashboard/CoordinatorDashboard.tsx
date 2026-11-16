// TODO(auditoria): painel da coordenação ainda mock; atribuído a outros desenvolvedores.
// Dados reais disponíveis hoje:
//   thesesApi.list({ scope: "coordinated", status: "ADVISOR_APPROVED" }) — aguardando agendamento
//   defenseApi.list({ status: "SCHEDULED" }) — próximas bancas
// KPIs acadêmicos (monografias, taxa de aprovação, bancas) dependem de
// `GET /api/v1/reports/overview`, ainda não implementado (ver ReportsView
// e FUNCIONALIDADES.md, seção "Pendências identificadas na auditoria").
// Remover `coordinatorQueue` (mockData.ts) ao conectar.
import type { Page } from "../../types"
import { coordinatorQueue } from "../../data/mockData"
import { Badge, Button, Card, Icon, Kpi } from "../../components/common"
interface Props {
  go: (page: Page) => void
}
export default function CoordinatorDashboard({ go }: Props) {
  return (
    <>
      <div className="kpi-grid">
        <Kpi
          label="Monografias ativas"
          value="84"
          meta="Semestre 2025.1"
          icon="file"
        />
        <Kpi
          label="Defesas concluídas"
          value="36"
          meta="12 neste mês"
          icon="check"
        />
        <Kpi
          label="Aprovações pendentes"
          value="8"
          meta="3 com prioridade"
          icon="clock"
        />
      </div>
      <div className="conflict-banner">
        <Icon name="alert" />
        <div>
          <strong>Conflito de agenda detectado</strong>
          <span>Prof. Ricardo participa de duas bancas em 20 jun, 14h.</span>
        </div>
        <Button variant="outline" onClick={() => go("schedule")}>
          Resolver conflito
        </Button>
      </div>
      <Card>
        <div className="section-head">
          <div>
            <p className="eyebrow">Operação de bancas</p>
            <h2>Aguardando agendamento</h2>
          </div>
          <Badge tone="light">8 trabalhos</Badge>
        </div>
        <div className="operation-list">
          {coordinatorQueue.map((item) => (
            <div key={item.student}>
              <div>
                <strong>{item.student}</strong>
                <span>
                  {item.course} · {item.approvedAt}
                </span>
              </div>
              <Button variant="outline" onClick={() => go("schedule")}>
                Agendar banca
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
