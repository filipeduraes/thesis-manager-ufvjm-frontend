import { useEffect, useState } from "react"
import { adminApi, ApiError, type AuditLogsPage, type AuditRecord } from "../api/client"
import {
  Badge,
  Button,
  Card,
  Icon,
  Modal,
  PageTitle,
  Pagination,
} from "../components/common"

const AUDIT_PAGE_SIZE = 50

const ENTITY_LABELS: Record<string, string> = {
  User: "Usuário",
  Course: "Curso",
  Department: "Departamento",
  UserCourseAssignment: "Vínculo de curso",
  ExternalInvitation: "Convite externo",
  SessionAudit: "Sessão",
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  COORDINATOR: "Coordenador",
  ADVISOR: "Orientador",
  STUDENT: "Aluno",
}

const FIELD_LABELS: Record<string, string> = {
  roles: "Perfis",
  role: "Perfil",
  course: "Curso",
  courseId: "Curso",
  is_active: "Status",
  status: "Status",
  name: "Nome",
  email: "E-mail",
  userName: "Usuário",
  userEmail: "E-mail do usuário",
  code: "Código",
  department: "Departamento",
  departmentName: "Departamento",
  coordinatorEmail: "Coordenador",
  coordinator_email: "Coordenador",
  institution: "Instituição",
}

function entityLabel(type: string): string {
  return ENTITY_LABELS[type] ?? type
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Ativo/Sim" : "Inativo/Não"
  if (Array.isArray(value)) return value.map((item) => ROLE_LABELS[String(item)] ?? formatScalar(item)).join(", ")
  if (typeof value === "object") return JSON.stringify(value, null, 2)
  return String(value)
}

function formatTransition(value: { from?: unknown; to?: unknown }): { before: string; after: string } {
  return {
    before: formatScalar(value.from),
    after: formatScalar(value.to),
  }
}

export default function SystemAudit() {
  const [auditPage, setAuditPage] = useState<AuditLogsPage | null>(null)
  const [search, setSearch] = useState({ filters: "", page: 1 })
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [role, setRole] = useState("")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState("")
  const [exportError, setExportError] = useState("")
  const [selected, setSelected] = useState<AuditRecord | null>(null)

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (role) params.set("role", role)
    const keyword = query.trim()
    if (keyword) params.set("q", keyword)
    changeSearch(params.toString(), 1)
  }

  const changeSearch = (filters: string, page: number) => {
    if (search.filters === filters && search.page === page && !error) return
    setLoading(true)
    setError("")
    setAuditPage(null)
    setSearch({ filters, page })
  }

  const clearFilters = () => {
    setFrom("")
    setTo("")
    setRole("")
    setQuery("")
    changeSearch("", 1)
  }

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams(search.filters)
    params.set("page", String(search.page))
    params.set("page_size", String(AUDIT_PAGE_SIZE))

    async function loadEvents() {
      try {
        const response = await adminApi.auditLogs(`?${params.toString()}`, controller.signal)
        if (!controller.signal.aborted) setAuditPage(response)
      } catch (reason) {
        if (controller.signal.aborted) return
        if (reason instanceof ApiError && reason.status === 404) {
          setError("A auditoria não está disponível neste acesso.")
        } else {
          setError(reason instanceof Error ? reason.message : "Não foi possível carregar a auditoria.")
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadEvents()
    return () => controller.abort()
  }, [search])

  const exportLogs = async () => {
    setExporting(true)
    setExportError("")
    try {
      await adminApi.exportAuditLogs(search.filters ? `?${search.filters}` : "")
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : "Não foi possível exportar o log.")
    } finally {
      setExporting(false)
    }
  }

  const changeEntries = (record: AuditRecord | null) => {
    if (!record) return []
    return Object.entries(record.changes ?? {}).map(([key, value]) => ({
      key,
      label: FIELD_LABELS[key] ?? key,
      value,
    }))
  }

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="Segurança e operações"
        title="Auditoria do sistema"
        action={
          <Button variant="secondary" icon="download" onClick={() => void exportLogs()} disabled={exporting}>
            {exporting ? "Exportando…" : "Exportar log"}
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
          <label htmlFor="audit-keyword">Palavra-chave</label>
          <div className="input-wrap">
            <Icon name="search" />
            <input id="audit-keyword" placeholder="Usuário, entidade ou ação" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </div>
        <div className="audit-filter-actions">
          <Button onClick={applyFilters}>Aplicar filtros</Button>
          <Button variant="secondary" onClick={clearFilters}>Limpar filtros</Button>
        </div>
      </Card>
      {error && <div className="success-notice" role="alert">{error}</div>}
      {exportError && <div className="success-notice" role="alert">{exportError}</div>}
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
            <span>Origem da rede</span>
            <span>Hash</span>
          </div>
          {loading ? <p role="status">Carregando eventos…</p> : auditPage?.results.map((event) => (
            <div
              className="admin-row"
              key={event.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(event)}
              onKeyDown={(keyboardEvent) => {
                if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                  keyboardEvent.preventDefault()
                  setSelected(event)
                }
              }}
              style={{ cursor: "pointer" }}
              title="Clique para ver detalhes"
            >
              <span data-label="Data e hora">
                <strong>{new Date(event.timestamp).toLocaleString("pt-BR")}</strong>
              </span>
              <span data-label="Ator">
                <strong>{event.actor}</strong>
                <small>{event.role}</small>
              </span>
              <span data-label="Ação">{event.summary ?? event.action}</span>
              <span data-label="Entidade">
                <strong>{entityLabel(event.entityType)}</strong>
                <small><code>{event.entityId}</code></small>
              </span>
              <span data-label="Origem da rede">
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
        {auditPage && (
          <>
            <p role="status">Total de registros: {auditPage.count.toLocaleString("pt-BR")}</p>
            {auditPage.results.length === 0 && <p>Nenhum evento encontrado.</p>}
            <Pagination
              page={search.page}
              totalPages={Math.ceil(auditPage.count / AUDIT_PAGE_SIZE)}
              onPageChange={(page) => changeSearch(search.filters, page)}
            />
          </>
        )}
      </Card>

      {selected && (
        <Modal className="admin-modal">
          <div className="section-head">
            <div>
              <p className="eyebrow">Detalhes da auditoria</p>
              <h2>{selected.summary ?? selected.action}</h2>
            </div>
            <button className="icon-btn" onClick={() => setSelected(null)} aria-label="Fechar">
              <Icon name="close" />
            </button>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <div><strong>Data e hora:</strong> {new Date(selected.timestamp).toLocaleString("pt-BR")}</div>
            <div><strong>Ator:</strong> {selected.actor} ({selected.role})</div>
            <div><strong>Canal:</strong> {selected.channel ?? "—"}</div>
            <div><strong>Ação:</strong> {selected.actionLabel ?? selected.actionCode ?? selected.action}</div>
            <div><strong>Entidade:</strong> {entityLabel(selected.entityType)} <code>{selected.entityId}</code></div>
            <div><strong>Origem da rede:</strong> {selected.origin}{selected.ipAddress ? ` · IP ${selected.ipAddress}` : ""}</div>
            <div><strong>Hash:</strong> <code>{selected.hash}</code></div>
            <div>
              <strong>Antes e depois / alterações</strong>
              {changeEntries(selected).length > 0 || Object.keys(selected.metadata ?? {}).length > 0 ? (
                <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                  {changeEntries(selected).map((entry) => {
                    const value = entry.value
                    if (value && typeof value === "object" && !Array.isArray(value) && "from" in (value as Record<string, unknown>) && "to" in (value as Record<string, unknown>)) {
                      const transition = formatTransition(value as { from?: unknown; to?: unknown })
                      return (
                        <div key={entry.key} style={{ display: "grid", gap: 4, padding: "8px 0", borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                          <span style={{ fontSize: 12, opacity: 0.8 }}>{entry.label}</span>
                          <div><strong>Antes:</strong> {transition.before}</div>
                          <div><strong>Depois:</strong> {transition.after}</div>
                        </div>
                      )
                    }
                    return (
                      <div key={entry.key} style={{ display: "grid", gap: 2, padding: "8px 0", borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                        <span style={{ fontSize: 12, opacity: 0.8 }}>{entry.label}</span>
                        <code style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{formatScalar(value)}</code>
                      </div>
                    )
                  })}
                  {Object.entries(selected.metadata ?? {}).map(([key, value]) => (
                    <div key={`meta-${key}`} style={{ display: "grid", gap: 2, padding: "8px 0", borderTop: "1px solid rgba(0,0,0,0.08)" }}>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>{FIELD_LABELS[key] ?? `Metadado: ${key}`}</span>
                      <code style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{formatScalar(value)}</code>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ marginTop: 8 }}>Nenhum detalhe adicional registrado para este evento.</p>
              )}
            </div>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setSelected(null)}>Fechar</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
