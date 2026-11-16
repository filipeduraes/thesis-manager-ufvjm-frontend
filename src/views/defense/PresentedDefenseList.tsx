import { useEffect, useState } from "react"
import { ApiError, defenseApi, type DefenseListItem } from "../../api/client"
import { Badge, Button, Card, Icon, Pagination } from "../../components/common"
import { DEFENSE_STATUS_OPTIONS, defenseStatusTone } from "../../data/defenseStatus"
import { formatDefenseTimeRange } from "./defenseSchedule"

// Mesmo tamanho de página da tela "Acompanhamento e aprovação".
const DEFENSE_PAGE_SIZE = 10

const FILTERS_STORAGE_KEY = "ufvjm:defense-list-filters"

interface PersistedDefenseFilters {
  searchInput: string
  query: string
  statusFilter: string
  pendingOnly: boolean
  page: number
}

const EMPTY_FILTERS: PersistedDefenseFilters = {
  searchInput: "",
  query: "",
  statusFilter: "",
  pendingOnly: false,
  page: 1,
}

function readPersistedFilters(): PersistedDefenseFilters {
  try {
    const raw = window.sessionStorage.getItem(FILTERS_STORAGE_KEY)
    if (!raw) return EMPTY_FILTERS
    const parsed = JSON.parse(raw) as Partial<PersistedDefenseFilters>
    return {
      searchInput: typeof parsed.searchInput === "string" ? parsed.searchInput : "",
      query: typeof parsed.query === "string" ? parsed.query : "",
      statusFilter: typeof parsed.statusFilter === "string" ? parsed.statusFilter : "",
      pendingOnly: parsed.pendingOnly === true,
      page: typeof parsed.page === "number" && parsed.page > 0 ? Math.floor(parsed.page) : 1,
    }
  } catch {
    return EMPTY_FILTERS
  }
}

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
})

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; defenses: DefenseListItem[]; count: number; totalPages: number }

function listErrorMessage(reason: unknown): string {
  if (reason instanceof ApiError && reason.status === 403) {
    return "Você não tem permissão para consultar bancas."
  }
  if (reason instanceof ApiError && reason.status === 429) {
    return "Muitas requisições em sequência. Aguarde alguns instantes e tente novamente."
  }
  return reason instanceof Error && reason.message ? reason.message : "Não foi possível carregar as bancas."
}

function locationText(defense: DefenseListItem): string {
  if (defense.location) return defense.location
  return defense.modality === "REMOTE" ? defense.modalityLabel : "Não informado"
}

interface PresentedDefenseListProps {
  onEvaluate: (defenseId: string) => void
  onOpenCommittee: (defenseId: string) => void
}

/**
 * Searchable, filterable list of the defenses visible to the current user, backed by
 * `GET /api/v1/defenses` (`q`, `status`, `pendingEvaluation`, `page`, `pageSize`).
 *
 * Mirrors the filter bar and table of `AdvisorApproval`: the search applies on Enter or
 * "Filtrar", while the status select and the checkbox apply immediately. Evaluation
 * actions follow `viewerMembership` and the defense link follows `viewerPermissions`:
 * "Gerenciar banca" for whoever manages it, "Ver banca" for everyone else.
 */
export default function PresentedDefenseList({ onEvaluate, onOpenCommittee }: PresentedDefenseListProps) {
  const [initialFilters] = useState(readPersistedFilters)
  const [searchInput, setSearchInput] = useState(initialFilters.searchInput)
  const [query, setQuery] = useState(initialFilters.query)
  const [statusFilter, setStatusFilter] = useState(initialFilters.statusFilter)
  const [pendingOnly, setPendingOnly] = useState(initialFilters.pendingOnly)
  const [page, setPage] = useState(initialFilters.page)
  const [reloadKey, setReloadKey] = useState(0)
  const [listState, setListState] = useState<ListState>({ status: "loading" })
  const [defenseUuid, setDefenseUuid] = useState("")
  const trimmedUuid = defenseUuid.trim()

  useEffect(() => {
    const filters: PersistedDefenseFilters = { searchInput, query, statusFilter, pendingOnly, page }
    window.sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters))
  }, [searchInput, query, statusFilter, pendingOnly, page])

  useEffect(() => {
    // A flag descarta respostas fora de ordem quando os filtros mudam rapidamente.
    let cancelled = false
    setListState({ status: "loading" })
    defenseApi
      .list({
        q: query,
        status: statusFilter,
        pendingEvaluation: pendingOnly || undefined,
        page,
        pageSize: DEFENSE_PAGE_SIZE,
      })
      .then((response) => {
        if (cancelled) return
        setListState({
          status: "ready",
          defenses: response.results,
          count: response.count,
          totalPages: response.totalPages,
        })
      })
      .catch((reason: unknown) => {
        if (!cancelled) setListState({ status: "error", message: listErrorMessage(reason) })
      })
    return () => {
      cancelled = true
    }
  }, [query, statusFilter, pendingOnly, page, reloadKey])

  const applyFilters = () => {
    setPage(1)
    setQuery(searchInput.trim())
  }

  const clearFilters = () => {
    setSearchInput("")
    setQuery("")
    setStatusFilter("")
    setPendingOnly(false)
    setPage(1)
  }

  const count = listState.status === "ready" ? listState.count : 0
  const totalPages = listState.status === "ready" ? listState.totalPages : 1

  return (
    <div className="presented-defense-list">
      <Card>
        <div className="filterbar">
          <div className="top-search">
            <Icon name="search" />
            <input
              placeholder="Buscar aluno, título, código ou local..."
              aria-label="Buscar bancas"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters()
              }}
            />
          </div>
          <select
            aria-label="Filtrar por status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Status: Todos</option>
            {DEFENSE_STATUS_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(event) => {
                setPendingOnly(event.target.checked)
                setPage(1)
              }}
            />
            <span>Somente aguardando meu parecer</span>
          </label>
          <Button variant="secondary" icon="filter" onClick={applyFilters}>
            Filtrar
          </Button>
        </div>
        <div className="results-head">
          <small aria-live="polite">
            {count} banca(s) encontrada(s)
            {query ? ` para “${query}”` : ""}
          </small>
          <button type="button" className="text-link" onClick={clearFilters}>
            Limpar filtros
          </button>
        </div>

        {listState.status === "loading" && (
          <div className="pdf-feedback">
            <div className="upload-icon">
              <Icon name="calendar" />
            </div>
            <strong>Carregando bancas…</strong>
            <span>Aplicando escopo de permissões do seu perfil.</span>
          </div>
        )}

        {listState.status === "error" && (
          <div className="form-error" role="alert">
            <Icon name="alert" size={16} />
            <span>{listState.message}</span>
            <Button variant="secondary" onClick={() => setReloadKey((current) => current + 1)}>
              Tentar novamente
            </Button>
          </div>
        )}

        {listState.status === "ready" && listState.defenses.length === 0 && (
          <div className="empty-state compact">
            <div>
              <Icon name="calendar" />
            </div>
            <h2>Nenhuma banca encontrada</h2>
            <p>
              {pendingOnly
                ? "Não há bancas aguardando o seu parecer neste momento."
                : "Ajuste os filtros ou agende uma nova banca."}
            </p>
          </div>
        )}

        {listState.status === "ready" && listState.defenses.length > 0 && (
          <div className="full-table defense-table">
            <div className="row head">
              <span>Aluno / Monografia</span>
              <span>Data e horário</span>
              <span>Local</span>
              <span>Status</span>
              <span>Minha participação</span>
              <span />
            </div>
            {listState.defenses.map((defense) => {
              const membership = defense.viewerMembership
              const openLabel = defense.viewerPermissions.canManage ? "Gerenciar banca" : "Ver banca"
              const scheduledDate = DATE_FORMATTER.format(new Date(defense.scheduledDatetime))
              const timeRange = formatDefenseTimeRange(defense.scheduledDatetime, defense.durationMinutes)
              return (
                <div className="row" key={defense.id}>
                  <span>
                    <strong>{defense.student?.name ?? "Autor não informado"}</strong>
                    <small>{defense.thesisTitle}</small>
                  </span>
                  <span>
                    {scheduledDate} · {timeRange}
                  </span>
                  <span>{locationText(defense)}</span>
                  <span>
                    <Badge tone={defenseStatusTone(defense.status)}>{defense.statusLabel}</Badge>
                  </span>
                  <span>{membership.isMember ? membership.roleLabel ?? "—" : "—"}</span>
                  <span className="row-actions">
                    {membership.hasEvaluated && <Badge tone="success">Parecer enviado</Badge>}
                    {membership.canEvaluate && !membership.hasEvaluated && (
                      <Button variant="outline" onClick={() => onEvaluate(defense.id)}>
                        Avaliar
                      </Button>
                    )}
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={openLabel}
                      title={openLabel}
                      onClick={() => onOpenCommittee(defense.id)}
                    >
                      <Icon name="arrow" />
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          disabled={listState.status === "loading"}
        />
      </Card>

      <details className="direct-defense-access">
        <summary>Abrir banca pelo ID</summary>
        <label className="field">
          <span>UUID da banca</span>
          <input
            value={defenseUuid}
            onChange={(event) => setDefenseUuid(event.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          />
        </label>
        <div className="form-actions">
          <Button variant="outline" disabled={!trimmedUuid} onClick={() => onEvaluate(trimmedUuid)}>
            Abrir avaliação
          </Button>
          <Button variant="outline" disabled={!trimmedUuid} onClick={() => onOpenCommittee(trimmedUuid)}>
            Gerenciar membros
          </Button>
        </div>
      </details>
    </div>
  )
}
