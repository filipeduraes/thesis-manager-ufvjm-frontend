import { useEffect, useState } from "react"
import { adminApi, ApiError, type AuditLogsPage, type AuditRecord } from "../api/client"
import {
  Button,
  Card,
  Icon,
  Modal,
  PageTitle,
  Pagination,
} from "../components/common"
import RoleMultiSelect from "../components/common/RoleMultiSelect"

const AUDIT_PAGE_SIZE = 50

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "access", label: "Acesso" },
  { value: "management", label: "Gestão" },
  { value: "thesis", label: "Monografia e defesa" },
  { value: "publication", label: "Publicação" },
  { value: "error", label: "Erro" },
]

const CATEGORY_COLORS: Record<string, string> = {
  access: "var(--slate)",
  management: "var(--navy)",
  thesis: "var(--sage)",
  publication: "var(--green)",
  error: "var(--danger)",
}

const ALL_CATEGORIES = CATEGORY_OPTIONS.map((o) => o.value)

const ENTITY_LABELS: Record<string, string> = {
  User: "Usuário",
  Course: "Curso",
  Department: "Departamento",
  UserCourseAssignment: "Vínculo de curso",
  ExternalInvitation: "Convite externo",
  SessionAudit: "Sessão",
}


const FIELD_TOOLTIPS: Record<string, string> = {
  "Usuário": "Nome do usuário afetado pela operação.",
  "E-mail": "Endereço de e-mail do usuário.",
  "Curso": "Curso vinculado ao registro.",
  "Código": "Código identificador do curso.",
  "Departamento": "Departamento ao qual o curso pertence.",
  "Coordenador": "Coordenador responsável pelo curso.",
  "TCC": "Título da monografia/TCC.",
  "Código do TCC": "Código de referência da monografia.",
  "Autor(es)": "Autores da monografia.",
  "Orientador": "Professor orientador da monografia.",
  "Versão": "Número da versão do arquivo PDF.",
  "Formato": "Visualização no site ou download do arquivo.",
  "Arquivo": "Nome original do arquivo enviado.",
  "Tipo de documento": "Tipo do documento complementar.",
  "Membro da banca": "Membro da comissão examinadora.",
  "Nota": "Nota atribuída pelo avaliador.",
  "Decisão": "Decisão do avaliador (aprovado, ajustes, reprovado).",
  "Data da defesa": "Data e hora agendada para a defesa.",
  "Status da defesa": "Situação atual da defesa.",
  "Perfis": "Perfis de acesso do usuário.",
  "Status": "Status ativo/inativo do registro.",
  "Instituição": "Instituição do convidado externo.",
  "Expira em": "Data de expiração do convite.",
  "Situação do convite": "Estado atual do convite externo.",
  "Escopo": "Escopo do relatório (todos os cursos ou coordenados).",
  "Ano de defesa": "Ano da defesa filtrado no relatório.",
  "Tamanho": "Tamanho do arquivo em bytes.",
  "SHA-256": "Hash de integridade do arquivo.",
}

function entityLabel(type: string): string {
  return ENTITY_LABELS[type] ?? type
}

export default function SystemAudit() {
  const [auditPage, setAuditPage] = useState<AuditLogsPage | null>(null)
  const [search, setSearch] = useState({ filters: "", page: 1 })
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [role, setRole] = useState("")
  const [categories, setCategories] = useState<string[]>(ALL_CATEGORIES)
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
    if (categories.length === 0) params.set("category", "none")
    else if (categories.length === ALL_CATEGORIES.length) params.set("category", "all")
    else params.set("category", categories.join(","))
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
    setCategories(ALL_CATEGORIES)
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
        <label className="field">
          <span>Categoria</span>
          <RoleMultiSelect
            options={CATEGORY_OPTIONS}
            value={categories}
            onChange={setCategories}
            placeholder="Todas as categorias"
            ariaLabel="Categorias de auditoria"
            allSelectedLabel="Todas as categorias"
            optionColors={CATEGORY_COLORS}
          />
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
            <span>Categoria</span>
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
                <small>{event.roles?.map((r) => r.label).join(", ") ?? event.role}</small>
              </span>
              <span data-label="Ação">{event.summary ?? event.action}</span>
              <span data-label="Entidade">
                <strong>{event.entityNameShort ?? event.entityName ?? entityLabel(event.entityType)}</strong>
                <small>{event.entityReference ?? event.entityId}</small>
              </span>
              <span data-label="Categoria">
                <span
                  style={{
                    background: CATEGORY_COLORS[(event.category ?? "").toLowerCase()] ?? "var(--line)",
                    color: "#fff",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {event.categoryLabel ?? event.category ?? "—"}
                </span>
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
              <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span
                  style={{
                    background: CATEGORY_COLORS[(selected.category ?? "").toLowerCase()] ?? "var(--line)",
                    color: "#fff",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  {selected.categoryLabel ?? selected.category ?? "—"}
                </span>
              </div>
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
            <div><strong>Entidade</strong>
              <div style={{ marginLeft: 12, display: "grid", gap: 2, fontSize: 13 }}>
                <div><span style={{ opacity: 0.7 }}>Tipo:</span> {selected.entityTypeLabel ?? entityLabel(selected.entityType)}</div>
                <div><span style={{ opacity: 0.7 }}>ID:</span> <code>{selected.entityId}</code></div>
                {selected.entityName && <div><span style={{ opacity: 0.7 }}>Nome:</span> {selected.entityName}</div>}
                {selected.entityReference && <div><span style={{ opacity: 0.7 }}>Referência:</span> {selected.entityReference}</div>}
              </div>
            </div>
            <div><strong>Origem da rede:</strong> {selected.origin}{selected.ipAddress ? ` · IP ${selected.ipAddress}` : ""}</div>
            <div><strong>Hash:</strong> <code>{selected.hash}</code></div>
            {selected.details && selected.details.length > 0 && (
              <div>
                <strong>Detalhes da operação</strong>
                <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                  {selected.details.map((entry, index) => {
                    const before = entry.before
                    const after = entry.after
                    const isTransition = before !== undefined && after !== undefined
                    return (
                      <div
                        key={`${entry.label}-${index}`}
                        style={{ display: "grid", gap: 2, padding: "6px 0", borderTop: "1px solid rgba(0,0,0,0.08)" }}
                      >
                        <span className="audit-tooltip" data-tooltip={FIELD_TOOLTIPS[entry.label] ?? entry.label} style={{ fontSize: 12, opacity: 0.75, cursor: "help", borderBottom: "1px dotted var(--slate)" }}>{entry.label}</span>
                        {isTransition ? (
                          <div style={{ display: "grid", gap: 2 }}>
                            <div style={{ color: before === "—" ? "var(--slate)" : "#9B1C31", textDecoration: before === "—" ? "none" : "line-through", opacity: 0.85 }}>
                              Antes: {before}
                            </div>
                            <div style={{ color: after === "—" ? "var(--slate)" : "#1f7a3d", fontWeight: 600 }}>
                              Depois: {after}
                            </div>
                          </div>
                        ) : (
                          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{entry.value}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setSelected(null)}>Fechar</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
