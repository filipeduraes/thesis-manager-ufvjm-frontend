import { auditEvents } from "../data/mockData"
import {
  Badge,
  Button,
  Card,
  Icon,
  PageTitle,
  Pagination,
} from "../components/common"

export default function SystemAudit() {
  // TODO: API Integration - GET /api/v1/admin/audit-logs
  // Query: { from, to, role, category, q }; Response: { logs: AuditLog[], total }
  return (
    <div className="page-content">
      <PageTitle
        eyebrow="Segurança e operações"
        title="Auditoria do sistema"
        action={
          <Button variant="secondary" icon="download">
            Exportar log
          </Button>
        }
      />
      <Card className="audit-filters">
        <label className="field">
          <span>Período inicial</span>
          <input type="date" defaultValue="2025-06-01" />
        </label>
        <label className="field">
          <span>Período final</span>
          <input type="date" defaultValue="2025-06-17" />
        </label>
        <label className="field">
          <span>Perfil</span>
          <select>
            <option>Todos os perfis</option>
            <option>Aluno</option>
            <option>Orientador</option>
            <option>Coordenador</option>
            <option>Administrador</option>
            <option>Sistema</option>
          </select>
        </label>
        <label className="field">
          <span>Categoria</span>
          <select>
            <option>Todas as ações</option>
            <option>Submissão</option>
            <option>Aprovação</option>
            <option>Agendamento</option>
            <option>Avaliação</option>
            <option>Acesso e perfil</option>
          </select>
        </label>
        <div className="field audit-search">
          <span>Palavra-chave</span>
          <div className="input-wrap">
            <Icon name="search" />
            <input placeholder="Usuário, entidade ou ação" />
          </div>
        </div>
        <Button>Aplicar filtros</Button>
      </Card>
      <Card className="audit-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Eventos registrados</p>
            <h2>Log operacional</h2>
          </div>
        </div>
        <div className="admin-table audit-table">
          <div className="admin-row head">
            <span>Data e hora</span>
            <span>Ator</span>
            <span>Ação</span>
            <span>Entidade</span>
            <span>Origem</span>
            <span>Hash</span>
          </div>
          {auditEvents.map((event) => (
            <div
              className="admin-row"
              key={`${event.timestamp}-${event.action}`}
            >
              <span data-label="Data e hora">
                <strong>{event.timestamp}</strong>
              </span>
              <span data-label="Ator">
                <strong>{event.actor}</strong>
                <small>{event.role}</small>
              </span>
              <span data-label="Ação">{event.action}</span>
              <span data-label="Entidade">
                <code>{event.entityId}</code>
              </span>
              <span data-label="Origem">
                <Badge tone="light">
                  <Icon name="lock" size={11} />
                  {event.origin}
                </Badge>
              </span>
              <span data-label="Hash">
                <code>{event.hash}</code>
              </span>
            </div>
          ))}
        </div>
        <Pagination />
      </Card>
    </div>
  )
}
