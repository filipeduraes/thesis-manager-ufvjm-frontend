import { useCallback, useEffect, useState } from "react"
import { adminApi, type AuditRecord } from "../api/client"
import {
  Badge,
  Button,
  Card,
  Icon,
  PageTitle,
} from "../components/common"

export default function SystemAudit() {
  const [events, setEvents] = useState<AuditRecord[]>([])
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [role, setRole] = useState("")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      if (role) params.set("role", role)
      if (query) params.set("q", query)
      const suffix = params.size ? `?${params.toString()}` : ""
      const response = await adminApi.auditLogs(suffix)
      setEvents(response.results)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar a auditoria.")
    } finally {
      setLoading(false)
    }
  }, [from, to, role, query])

  useEffect(() => { void loadEvents() }, [loadEvents])
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
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field">
          <span>Período final</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <label className="field">
          <span>Perfil</span>
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="">Todos os perfis</option>
            <option value="STUDENT">Aluno</option>
            <option value="ADVISOR">Orientador</option>
            <option value="COORDINATOR">Coordenador</option>
            <option value="ADMIN">Administrador</option>
            <option value="Sistema">Sistema</option>
          </select>
        </label>
        <div className="field audit-search">
          <span>Palavra-chave</span>
          <div className="input-wrap">
            <Icon name="search" />
            <input placeholder="Usuário, entidade ou ação" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </div>
        <Button onClick={() => void loadEvents()}>Aplicar filtros</Button>
      </Card>
      {error && <div className="success-notice" role="alert">{error}</div>}
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
          {loading ? <p>Carregando eventos…</p> : events.map((event) => (
            <div
              className="admin-row"
              key={event.id}
            >
              <span data-label="Data e hora">
                <strong>{new Date(event.timestamp).toLocaleString("pt-BR")}</strong>
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
        {events.length === 0 && !loading && <p>Nenhum evento encontrado.</p>}
      </Card>
    </div>
  )
}
