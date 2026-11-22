import { useEffect, useRef, useState } from "react"
import type { FormEvent, KeyboardEvent } from "react"
import { ApiError, repositoryApi, type PublicRepositoryPage } from "../api/client"
import { apiErrorMessage } from "../api/errors"
import { Badge, Button, Icon, Logo, Pagination, SelectField } from "../components/common"
import { formatDateOnly } from "../data/dateFormat"
import { formatBytes, formatDate, formatDateTime, shortHash } from "../data/thesisStatus"
import type {
  Page,
  PublicRepositoryFilters,
  PublicRepositoryThesis,
  PublicRepositoryThesisDetail,
  RepositoryOrdering,
} from "../types"

const PAGE_SIZE = 10
/** Limite do backend para `keyword` repetido em uma busca. */
const MAX_SELECTED_KEYWORDS = 10
const KEYWORD_PREVIEW_COUNT = 15

interface RepositorySearch {
  q: string
  courseId: string
  advisorId: string
  year: string
  keywords: string[]
}

const EMPTY_SEARCH: RepositorySearch = { q: "", courseId: "", advisorId: "", year: "", keywords: [] }

const ORDERING_OPTIONS: Array<{ value: RepositoryOrdering; label: string }> = [
  { value: "relevance", label: "Ordenar: Relevância" },
  { value: "recent", label: "Mais recentes" },
  { value: "title", label: "Título A–Z" },
]

const NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR")

function hasActiveSearch(search: RepositorySearch): boolean {
  return Boolean(search.q || search.courseId || search.advisorId || search.year || search.keywords.length > 0)
}

function searchErrorMessage(reason: unknown): string {
  if (reason instanceof ApiError && reason.status === 429) {
    return "Muitas buscas em pouco tempo. Aguarde alguns instantes e tente novamente."
  }
  if (reason instanceof ApiError && reason.status === 400) {
    return `Não foi possível aplicar a busca: ${reason.message} Revise os filtros e tente novamente.`
  }
  return apiErrorMessage(reason, "Não foi possível carregar o repositório.")
}

function downloadErrorMessage(reason: unknown): string {
  if (reason instanceof ApiError && reason.status === 429) {
    return "Muitos downloads em pouco tempo. Aguarde um minuto e tente novamente."
  }
  return apiErrorMessage(reason, "Não foi possível baixar o PDF.")
}

function pdfFilename(thesis: { referenceCode: string }): string {
  const safe = thesis.referenceCode.replace(/[^A-Za-z0-9_-]+/g, "")
  return `${safe || "monografia"}.pdf`
}

function resultsHeading(count: number): string {
  const formatted = NUMBER_FORMATTER.format(count)
  return count === 1 ? `${formatted} monografia encontrada` : `${formatted} monografias encontradas`
}

interface PublicRepositoryProps {
  go: (page: Page) => void
  /** Rendered inside the authenticated layout (sidebar and topbar): no public header or footer. */
  embedded?: boolean
  /**
   * Whether a session is active. The public header then offers "Voltar ao sistema"
   * (to the home screen) instead of "Entrar".
   */
  hasSession?: boolean
}

/**
 * Public repository of published theses, open to anonymous visitors.
 *
 * Every figure, filter option and result comes from the anonymous endpoints
 * (`/public/theses`, `/public/theses/filters`, `/public/theses/<id>`); no session is needed.
 */
export default function PublicRepository({ go, embedded = false, hasSession = false }: PublicRepositoryProps) {
  const [draft, setDraft] = useState<RepositorySearch>(EMPTY_SEARCH)
  const [applied, setApplied] = useState<RepositorySearch>(EMPTY_SEARCH)
  const [ordering, setOrdering] = useState<RepositoryOrdering | "">("")
  const [page, setPage] = useState(1)
  const [results, setResults] = useState<PublicRepositoryPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchAttempt, setSearchAttempt] = useState(0)
  const [filters, setFilters] = useState<PublicRepositoryFilters | null>(null)
  const [filtersError, setFiltersError] = useState("")
  const [filtersAttempt, setFiltersAttempt] = useState(0)
  const [showAllKeywords, setShowAllKeywords] = useState(false)
  const [keywordLimitHint, setKeywordLimitHint] = useState("")
  const [downloadError, setDownloadError] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setFiltersError("")
    repositoryApi
      .filters(controller.signal)
      .then((payload) => {
        if (!controller.signal.aborted) setFilters(payload)
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setFiltersError(searchErrorMessage(reason))
      })
    return () => controller.abort()
  }, [filtersAttempt])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")
    repositoryApi
      .search(
        {
          q: applied.q,
          courseId: applied.courseId || undefined,
          advisorId: applied.advisorId || undefined,
          year: applied.year ? Number(applied.year) : undefined,
          keywords: applied.keywords,
          ordering: ordering || undefined,
          page,
          pageSize: PAGE_SIZE,
        },
        controller.signal,
      )
      .then((payload) => {
        if (!controller.signal.aborted) setResults(payload)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setResults(null)
        setError(searchErrorMessage(reason))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [applied, ordering, page, searchAttempt])

  const applySearch = (next: RepositorySearch) => {
    const normalized = { ...next, q: next.q.split(/\s+/).filter(Boolean).join(" ") }
    setDraft(normalized)
    setApplied(normalized)
    setPage(1)
    if (!normalized.q && ordering === "relevance") setOrdering("")
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    applySearch(draft)
  }

  const clearFilters = () => {
    setKeywordLimitHint("")
    applySearch({ ...EMPTY_SEARCH, q: draft.q })
  }

  const clearEverything = () => {
    setKeywordLimitHint("")
    setOrdering("")
    applySearch(EMPTY_SEARCH)
  }

  const restartRepository = () => {
    clearEverything()
    setSelectedId(null)
    setDownloadError("")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const toggleKeyword = (value: string) => {
    setKeywordLimitHint("")
    if (draft.keywords.includes(value)) {
      setDraft({ ...draft, keywords: draft.keywords.filter((keyword) => keyword !== value) })
      return
    }
    if (draft.keywords.length >= MAX_SELECTED_KEYWORDS) {
      setKeywordLimitHint(`Selecione no máximo ${MAX_SELECTED_KEYWORDS} palavras-chave.`)
      return
    }
    setDraft({ ...draft, keywords: [...draft.keywords, value] })
  }

  const download = async (path: string, filename: string) => {
    setDownloadError("")
    try {
      await repositoryApi.download(path, filename)
    } catch (reason) {
      setDownloadError(downloadErrorMessage(reason))
    }
  }

  const effectiveOrdering: RepositoryOrdering = ordering || (applied.q ? "relevance" : "recent")
  const keywordOptions = filters?.keywords ?? []
  const visibleKeywords = showAllKeywords ? keywordOptions : keywordOptions.slice(0, KEYWORD_PREVIEW_COUNT)
  const courseOptions = [
    { value: "", label: "Todos os cursos" },
    ...(filters?.courses ?? []).map((course) => ({ value: course.id, label: `${course.name} (${course.count})` })),
  ]
  const advisorOptions = [
    { value: "", label: "Todos os orientadores" },
    ...(filters?.advisors ?? []).map((advisor) => ({ value: advisor.id, label: `${advisor.name} (${advisor.count})` })),
  ]
  const yearOptions = [
    { value: "", label: "Todos os anos" },
    ...(filters?.years ?? []).map((entry) => ({ value: String(entry.year), label: `${entry.year} (${entry.count})` })),
  ]
  const works = results?.results ?? []

  return (
    <div className={embedded ? "public-page embedded" : "public-page"}>
      {!embedded && (
        <header className="public-header">
          <Logo />
          <nav aria-label="Navegação do repositório">
            <button type="button" onClick={restartRepository}>
              Repositório
            </button>
            <a href="https://portal.ufvjm.edu.br/" target="_blank" rel="noopener noreferrer">
              Portal da UFVJM
            </a>
            {hasSession ? (
              <button type="button" onClick={() => go("dashboard")}>
                Voltar ao sistema
              </button>
            ) : (
              <button type="button" onClick={() => go("login")}>
                Entrar
              </button>
            )}
          </nav>
        </header>
      )}
      <section className="repo-hero">
        <div>
          <div className="repo-hero-copy">
            <h1>Repositório de Monografias</h1>
            <form className="hero-search" role="search" onSubmit={submitSearch}>
              <Icon name="search" size={22} />
              <input
                aria-label="Buscar no repositório"
                value={draft.q}
                maxLength={200}
                onChange={(event) => setDraft({ ...draft, q: event.target.value })}
                placeholder="Busque por título, autor, orientador ou palavra-chave"
              />
              <Button type="submit">Pesquisar</Button>
            </form>
          </div>
        </div>
      </section>
      <main className="repo-main">
        <aside className="filters" aria-label="Filtros da busca">
          <div className="section-head">
            <div>
              <p className="eyebrow">Refinar busca</p>
              <h3>Filtros</h3>
            </div>
            <button type="button" className="text-link" onClick={clearFilters}>
              Limpar
            </button>
          </div>
          {filtersError && (
            <div className="form-error" role="alert">
              <span>Não foi possível carregar os filtros. {filtersError}</span>
              <Button variant="secondary" onClick={() => setFiltersAttempt((current) => current + 1)}>
                Tentar novamente
              </Button>
            </div>
          )}
          <SelectField
            label="Curso"
            options={courseOptions}
            value={draft.courseId}
            onChange={(courseId) => setDraft({ ...draft, courseId })}
          />
          <SelectField
            label="Orientador"
            options={advisorOptions}
            value={draft.advisorId}
            onChange={(advisorId) => setDraft({ ...draft, advisorId })}
          />
          <SelectField
            label="Ano de defesa"
            options={yearOptions}
            value={draft.year}
            onChange={(year) => setDraft({ ...draft, year })}
          />
          <div className="field">
            <span id="repository-keywords-label">Palavras-chave</span>
            {keywordOptions.length === 0 ? (
              <small>{filters ? "Nenhuma palavra-chave publicada." : "Carregando palavras-chave…"}</small>
            ) : (
              <div className="tag-cloud" role="group" aria-labelledby="repository-keywords-label">
                {visibleKeywords.map((keyword) => (
                  <button
                    type="button"
                    key={keyword.value}
                    className={draft.keywords.includes(keyword.value) ? "active" : ""}
                    aria-pressed={draft.keywords.includes(keyword.value)}
                    onClick={() => toggleKeyword(keyword.value)}
                  >
                    {keyword.name} ({keyword.count})
                  </button>
                ))}
              </div>
            )}
            {keywordOptions.length > KEYWORD_PREVIEW_COUNT && (
              <button type="button" className="text-link" onClick={() => setShowAllKeywords((current) => !current)}>
                {showAllKeywords ? "Mostrar menos" : `Mostrar todas (${keywordOptions.length})`}
              </button>
            )}
            {keywordLimitHint && <small role="status">{keywordLimitHint}</small>}
          </div>
          <Button onClick={() => applySearch(draft)}>Aplicar filtros</Button>
        </aside>
        <section className="results" aria-busy={loading}>
          <div className="results-head">
            <div>
              <p className="eyebrow">Resultados</p>
              <h2 aria-live="polite">
                {loading && !results ? "Buscando monografias…" : resultsHeading(results?.count ?? 0)}
              </h2>
            </div>
            <select
              aria-label="Ordenar resultados"
              value={effectiveOrdering}
              onChange={(event) => {
                const next = ORDERING_OPTIONS.find((option) => option.value === event.target.value)
                setOrdering(next?.value ?? "")
                setPage(1)
              }}
            >
              {ORDERING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} disabled={option.value === "relevance" && !applied.q}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {downloadError && !selectedId && (
            <div className="form-error" role="alert">
              <Icon name="alert" size={16} />
              <span>{downloadError}</span>
            </div>
          )}
          {loading && (
            <div className="pdf-feedback" role="status">
              <strong>Carregando resultados…</strong>
            </div>
          )}
          {!loading && error && (
            <div className="empty-state" role="alert">
              <div>
                <Icon name="alert" size={28} />
              </div>
              <h2>Não foi possível carregar o repositório</h2>
              <p>{error}</p>
              <Button variant="secondary" onClick={() => setSearchAttempt((current) => current + 1)}>
                Tentar novamente
              </Button>
            </div>
          )}
          {!loading && !error && works.length === 0 && (
            <div className="empty-state">
              <div>
                <Icon name="search" size={28} />
              </div>
              <h2>Nenhum resultado encontrado</h2>
              <p>
                {hasActiveSearch(applied)
                  ? "Tente remover filtros ou usar termos mais abrangentes."
                  : "Ainda não há monografias publicadas no repositório."}
              </p>
              {hasActiveSearch(applied) && (
                <Button variant="secondary" onClick={clearEverything}>
                  Limpar busca
                </Button>
              )}
            </div>
          )}
          {!loading && !error && works.length > 0 && (
            <div className="work-list">
              {works.map((work) => (
                <WorkCard
                  key={work.id}
                  work={work}
                  onOpen={() => setSelectedId(work.id)}
                  onDownload={(path) => void download(path, pdfFilename(work))}
                />
              ))}
            </div>
          )}
          {!error && results && (
            <Pagination page={results.page} totalPages={results.totalPages} onPageChange={setPage} disabled={loading} />
          )}
        </section>
      </main>
      {selectedId && (
        <ThesisDetailDrawer
          thesisId={selectedId}
          onClose={() => {
            setDownloadError("")
            setSelectedId(null)
          }}
          downloadError={downloadError}
          onDownload={(path, filename) => download(path, filename)}
        />
      )}
      {!embedded && (
        <footer>
          <Logo />
          <span>© 2026 UFVJM · Acessibilidade · Privacidade</span>
        </footer>
      )}
    </div>
  )
}

interface WorkCardProps {
  work: PublicRepositoryThesis
  onOpen: () => void
  onDownload: (path: string) => void
}

function WorkCard({ work, onOpen, onDownload }: WorkCardProps) {
  const authors = work.authorNames.join(", ") || "Autoria não informada"
  return (
    <article className="work-card">
      <div className="work-year">
        <strong>{work.defenseYear ?? "—"}</strong>
        <span>Defesa</span>
      </div>
      <div>
        <span className="course">{work.course.name}</span>
        <h3>{work.title}</h3>
        <p className="work-meta">
          <strong>{authors}</strong>
          {work.advisor ? ` · Orientação: ${work.advisor.name}` : ""}
        </p>
        <p>{work.abstract}</p>
        <div className="tags">
          {work.keywords.map((keyword) => (
            <Badge tone="light" key={keyword}>
              {keyword}
            </Badge>
          ))}
        </div>
      </div>
      <div className="work-actions">
        <Button variant="secondary" onClick={onOpen}>
          Ver detalhes
        </Button>
        {work.currentFile && (
          <Button variant="ghost" icon="download" onClick={() => work.currentFile && onDownload(work.currentFile.downloadUrl)}>
            Baixar PDF
          </Button>
        )}
      </div>
    </article>
  )
}

interface ThesisDetailDrawerProps {
  thesisId: string
  onClose: () => void
  downloadError: string
  onDownload: (path: string, filename: string) => Promise<void>
}

function ThesisDetailDrawer({ thesisId, onClose, downloadError, onDownload }: ThesisDetailDrawerProps) {
  const [detail, setDetail] = useState<PublicRepositoryThesisDetail | null>(null)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setDetail(null)
    setError("")
    repositoryApi
      .detail(thesisId, controller.signal)
      .then(({ thesis }) => {
        if (!controller.signal.aborted) setDetail(thesis)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        const notFound = reason instanceof ApiError && reason.status === 404
        setError(notFound ? "Esta monografia não está mais disponível no repositório." : searchErrorMessage(reason))
      })
    return () => controller.abort()
  }, [thesisId, attempt])

  const closeOnEscape = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") onClose()
  }

  const previousVersions = detail?.fileVersions.filter((version) => !version.isCurrent) ?? []

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="repository-detail-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={closeOnEscape}
      >
        <div className="drawer-head">
          <Badge tone="success">Publicada</Badge>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Fechar detalhes">
            <Icon name="close" />
          </button>
        </div>
        {!detail && !error && (
          <p id="repository-detail-title" role="status">
            Carregando detalhes da monografia…
          </p>
        )}
        {error && (
          <div role="alert">
            <h2 id="repository-detail-title">Não foi possível abrir a monografia</h2>
            <p>{error}</p>
            <Button variant="secondary" onClick={() => setAttempt((current) => current + 1)}>
              Tentar novamente
            </Button>
          </div>
        )}
        {detail && (
          <>
            <span className="course">{detail.course.name}</span>
            <h2 id="repository-detail-title">{detail.title}</h2>
            <p className="drawer-author">
              {detail.authorNames.join(", ")}
              {detail.advisor ? ` · Orientação: ${detail.advisor.name}` : ""}
            </p>
            <hr />
            <dl className="drawer-metadata">
              <div>
                <dt>Tipo de trabalho</dt>
                <dd>{detail.typeLabel}</dd>
              </div>
              <div>
                <dt>Ano de defesa</dt>
                <dd>{detail.defenseYear ?? "—"}</dd>
              </div>
              <div>
                <dt>Data de defesa</dt>
                <dd>{formatDateOnly(detail.defenseDate)}</dd>
              </div>
              <div>
                <dt>Publicada em</dt>
                <dd>{formatDate(detail.publishedAt)}</dd>
              </div>
              <div className="wide">
                <dt>Curso</dt>
                <dd>
                  {detail.course.name} ({detail.course.code})
                </dd>
              </div>
              <div className="wide">
                <dt>Orientador</dt>
                <dd>{detail.advisor?.name ?? "—"}</dd>
              </div>
              {detail.type === "ARTICLE" && detail.journal && (
                <div className="wide">
                  <dt>Periódico</dt>
                  <dd>{detail.journal}</dd>
                </div>
              )}
            </dl>
            <h4>Autores</h4>
            <ul>
              {detail.authors.map((author) => (
                <li key={author.id}>
                  {author.name}
                  {author.isMainAuthor ? " · Autor principal" : ""}
                </li>
              ))}
            </ul>
            <h4>Resumo</h4>
            <p>{detail.abstract}</p>
            <h4>Palavras-chave</h4>
            <div className="drawer-keywords">
              {detail.keywords.map((keyword) => (
                <Badge tone="light" key={keyword}>
                  {keyword}
                </Badge>
              ))}
            </div>
            {detail.integrity && (
              <>
                <h4>Integridade do arquivo</h4>
                <div className="hash drawer-hash">
                  <span>{detail.integrity.algorithm}</span>
                  <code aria-label="Hash SHA-256 do PDF publicado">{detail.integrity.sha256}</code>
                  <Badge tone="light">{detail.integrity.hashVerifiedAt ? "Verificado" : "Não verificado"}</Badge>
                </div>
                <small>
                  Versão {detail.integrity.versionNumber} · {formatBytes(detail.integrity.sizeBytes)}
                  {detail.integrity.hashVerifiedAt
                    ? ` · verificado em ${formatDateTime(detail.integrity.hashVerifiedAt)}`
                    : ""}
                </small>
              </>
            )}
            {previousVersions.length > 0 && (
              <>
                <h4>Versões anteriores</h4>
                <ul>
                  {previousVersions.map((version) => (
                    <li key={version.versionNumber}>
                      Versão {version.versionNumber} · SHA-256 {shortHash(version.sha256)}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {downloadError && (
              <div className="form-error" role="alert">
                <Icon name="alert" size={16} />
                <span>{downloadError}</span>
              </div>
            )}
            {detail.currentFile && (
              <Button
                icon="download"
                onClick={() => detail.currentFile && void onDownload(detail.currentFile.downloadUrl, pdfFilename(detail))}
              >
                Baixar PDF completo
              </Button>
            )}
          </>
        )}
      </aside>
    </div>
  )
}
