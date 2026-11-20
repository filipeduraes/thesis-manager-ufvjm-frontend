import { useEffect, useId, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ApiError, downloadApiFile, publicSearchApi, thesesApi } from "../../api/client"
import type { PublicThesisDetail } from "../../api/client"
import { searchShortcuts, searchSources } from "../../data/globalSearch"
import type { SearchDestination, SearchResult } from "../../data/globalSearch"
import { useGlobalSearch } from "../../hooks/useGlobalSearch"
import type { NavigationItem } from "../../types"
import { Button, Icon, Modal } from "../common"

interface GlobalSearchProps {
  menuItems: NavigationItem[]
  canReadDirectory: boolean
  onClose: () => void
  onNavigate: (destination: SearchDestination) => void
  onSessionExpired: () => void
}

export default function GlobalSearch({
  menuItems, canReadDirectory, onClose, onNavigate, onSessionExpired,
}: GlobalSearchProps) {
  const titleId = useId()
  const input = useRef<HTMLInputElement>(null)
  const resultsPanel = useRef<HTMLDivElement>(null)
  const backButton = useRef<HTMLButtonElement>(null)
  const resultFocusId = useRef("")
  const request = useRef<AbortController | undefined>(undefined)
  const downloadRequest = useRef<AbortController | undefined>(undefined)
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<SearchResult>()
  const [thesisDetail, setThesisDetail] = useState<PublicThesisDetail>()
  const [detailError, setDetailError] = useState("")
  const [downloadError, setDownloadError] = useState("")
  const [downloading, setDownloading] = useState(false)
  const term = query.trim()
  const sources = useMemo(() => searchSources(menuItems, canReadDirectory), [menuItems, canReadDirectory])
  const groups = useGlobalSearch(term, sources, onSessionExpired)
  const shortcuts = searchShortcuts(menuItems, term)
  const loading = groups.some(({ results, error }) => !results && !error)
  const hasMatches = shortcuts.length > 0 || groups.some(({ results }) => Boolean(results?.length))
  const hasErrors = groups.some(({ error }) => Boolean(error))

  useEffect(() => () => {
    request.current?.abort()
    downloadRequest.current?.abort()
  }, [])

  useEffect(() => {
    if (selected) {
      backButton.current?.focus()
    } else {
      const focusTarget = document.getElementById(resultFocusId.current) ?? input.current
      focusTarget?.focus()
      resultFocusId.current = ""
    }
  }, [selected])

  const openResult = (result: SearchResult, buttonId: string) => {
    const { destination } = result
    if (destination.kind !== "publication" && destination.kind !== "authoredThesis" && destination.kind !== "person") {
      onNavigate(destination)
      onClose()
      return
    }
    resultFocusId.current = buttonId
    setSelected(result)
    if (destination.kind === "person") return
    const controller = new AbortController()
    request.current = controller
    const loadDetail = destination.kind === "publication" ? publicSearchApi.thesis : thesesApi.detail
    void loadDetail(destination.id, controller.signal).then(
      ({ thesis }) => {
        if (!controller.signal.aborted) setThesisDetail(thesis)
      },
      (error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && error.status === 401) onSessionExpired()
        else setDetailError("Não foi possível carregar a monografia.")
      },
    )
  }

  const backToResults = () => {
    request.current?.abort()
    downloadRequest.current?.abort()
    downloadRequest.current = undefined
    setSelected(undefined)
    setThesisDetail(undefined)
    setDetailError("")
    setDownloadError("")
    setDownloading(false)
  }

  const downloadPublication = async () => {
    const file = thesisDetail?.currentFile
    if (!file || downloadRequest.current) return
    const controller = new AbortController()
    downloadRequest.current = controller
    backButton.current?.focus()
    setDownloading(true)
    setDownloadError("")
    try {
      await downloadApiFile(file.downloadUrl, file.storedFile.originalFilename, controller.signal)
    } catch {
      if (!controller.signal.aborted) setDownloadError("Não foi possível baixar o PDF.")
    } finally {
      if (!controller.signal.aborted) {
        setDownloading(false)
        downloadRequest.current = undefined
      }
    }
  }

  const renderGroup = (label: string, results: SearchResult[] = [], error?: string) => (
    <section className="global-search-group" key={label} aria-label={label}>
      <h3>{label}</h3>
      {error && <p role="status">{error}</p>}
      {results.length > 0 && (
        <ul>
          {results.map((result) => {
            const buttonId = `${titleId}-${label}-${result.id}`.replaceAll(" ", "-")
            const summary = result.personSummary
            return (
              <li key={result.id}>
                <button id={buttonId} type="button" onClick={() => openResult(result, buttonId)}>
                  <strong>{result.title}</strong>
                  {result.subtitle && <small>{result.subtitle}</small>}
                </button>
                {summary && (
                  <button id={`${buttonId}-summary`} type="button" aria-label={`Ver resumo de ${result.title}`}
                    onClick={(event) => openResult({
                      ...result,
                      subtitle: summary.subtitle,
                      destination: { kind: "person", email: summary.email },
                    }, event.currentTarget.id)}>
                    <small>Ver resumo</small>
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )

  return createPortal(
    <Modal className="global-search-dialog" labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId}>Pesquisar no sistema</h2>
      {!selected && <div>
        <label className="field global-search-field">
          <span>Buscar páginas, pessoas e trabalhos</span>
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return
              if (event.key === "ArrowDown" || event.key === "Enter") {
                const firstResult = resultsPanel.current?.querySelector("button")
                if (!firstResult) return
                event.preventDefault()
                if (event.key === "Enter") firstResult.click()
                else firstResult.focus()
              }
            }}
          />
        </label>
        <div
          ref={resultsPanel}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
            const buttons = Array.from(resultsPanel.current?.querySelectorAll("button") ?? [])
            const current = buttons.findIndex((button) => button === document.activeElement)
            if (current < 0) return
            event.preventDefault()
            if (event.key === "ArrowUp" && current === 0) input.current?.focus()
            else buttons[current + (event.key === "ArrowDown" ? 1 : -1)]?.focus()
          }}
        >
          {shortcuts.length > 0 && renderGroup("Páginas e funcionalidades", shortcuts)}
          {groups.map(({ label, results, error }) =>
            results?.length || error ? renderGroup(label, results, error) : null,
          )}
        </div>
        <div role="status" className="global-search-status">
          {term.length < 3 && "Digite pelo menos três caracteres para buscar registros."}
          {loading && "Buscando registros…"}
          {term.length >= 3 && !loading && !hasMatches && (
            hasErrors ? "Nenhum resultado nas categorias disponíveis." : "Nenhum resultado encontrado."
          )}
        </div>
      </div>}
      {selected && (
        <div className="global-search-detail">
          <h3>{thesisDetail?.title ?? selected.title}</h3>
          {selected.subtitle && <p>{selected.subtitle}</p>}
          {selected.destination.kind === "person" && selected.destination.email && <p>{selected.destination.email}</p>}
          {selected.destination.kind !== "person" && !thesisDetail && (
            detailError ? <p role="alert">{detailError}</p> : <p role="status">Carregando monografia…</p>
          )}
          {thesisDetail && (
            <>
              {thesisDetail.student && <p><strong>Autor principal</strong> {thesisDetail.student.name}</p>}
              <p><strong>Orientação</strong> {thesisDetail.advisor.name}</p>
              {thesisDetail.abstract && <p>{thesisDetail.abstract}</p>}
              {thesisDetail.keywords.length > 0 && <p>{thesisDetail.keywords.join(" · ")}</p>}
              {selected.destination.kind === "publication" && thesisDetail.currentFile && (
                <Button icon="download" disabled={downloading} onClick={() => void downloadPublication()}>
                  {downloading ? "Baixando PDF…" : "Baixar PDF"}
                </Button>
              )}
              {downloadError && <p role="alert">{downloadError}</p>}
            </>
          )}
          <button ref={backButton} type="button" className="btn btn-secondary" onClick={backToResults}>
            Voltar aos resultados
          </button>
        </div>
      )}
      <button type="button" className="icon-btn global-search-close" aria-label="Fechar pesquisa" onClick={onClose}>
        <Icon name="close" />
      </button>
    </Modal>,
    document.body,
  )
}
