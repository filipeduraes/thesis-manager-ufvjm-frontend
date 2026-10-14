import type { Page } from "../../types"
import { auditSnippet, systemServices } from "../../data/mockData"
import { Badge, Card, Kpi } from "../../components/common"
interface Props {
  go: (page: Page) => void
}
export default function AdminDashboard({ go }: Props) {
  return (
    <>
      <div className="kpi-grid four">
        <Kpi
          label="Usuários ativos"
          value="1.284"
          meta="+38 neste mês"
          icon="users"
        />
        <Kpi
          label="Cursos sincronizados"
          value="42"
          meta="100% atualizados"
          icon="book"
        />
        <Kpi
          label="Monografias ativas"
          value="312"
          meta="Todos os campi"
          icon="file"
        />
        <Kpi
          label="Carga do repositório"
          value="68%"
          meta="4,2 TB disponíveis"
          icon="chart"
        />
      </div>
      <div className="admin-dashboard">
        <Card>
          <div className="section-head">
            <div>
              <p className="eyebrow">Infraestrutura</p>
              <h2>Saúde dos serviços</h2>
            </div>
            <Badge tone="success">Operacional</Badge>
          </div>
          <div className="service-grid">
            {systemServices.map((service) => (
              <div key={service.name}>
                <i className="status-dot" />
                <div>
                  <strong>{service.name}</strong>
                  <span>{service.metric}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="section-head">
            <div>
              <p className="eyebrow">Auditoria ao vivo</p>
              <h2>Eventos recentes</h2>
            </div>
            <button className="text-link" onClick={() => go("audit")}>
              Abrir auditoria
            </button>
          </div>
          <div className="audit-snippet">
            {auditSnippet.map((item) => (
              <div key={item.time}>
                <time>{item.time}</time>
                <span>{item.event}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
