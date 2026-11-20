import { useEffect, useMemo, useRef, useState } from "react"
import { ApiError } from "../api/client"
import type { searchSources, SearchResult } from "../data/globalSearch"

interface SearchGroup {
  label: string
  results?: SearchResult[]
  error?: string
}

interface SearchResponse {
  request: object
  groups: SearchGroup[]
}

const CACHE_DURATION_MS = 20_000
const CACHE_LIMIT = 32

function uniquePeople(groups: SearchGroup[]): SearchGroup[] {
  // A ordem das fontes dá prioridade ao resultado administrativo e depois ao diretório institucional.
  const seen = new Map<string, SearchResult>()
  let higherPending = false
  return groups.map(({ results, ...group }) => {
    if (higherPending) return group
    if (!results && !group.error) higherPending = true
    const uniqueResults = results?.flatMap((result) => {
      const first = seen.get(result.id)
      if (!first) {
        const row = { ...result }
        seen.set(result.id, row)
        return [row]
      }
      if (first.destination.kind === "page" && !first.personSummary && result.destination.kind === "person") {
        first.personSummary = { email: result.destination.email, subtitle: result.subtitle }
      }
      return []
    })
    return { ...group, results: uniqueResults }
  })
}

/** Loads each eligible source independently and discards responses for superseded searches. */
export function useGlobalSearch(
  query: string,
  sources: ReturnType<typeof searchSources>,
  onSessionExpired: () => void,
): SearchGroup[] {
  const [response, setResponse] = useState<SearchResponse>()
  const cache = useRef(new Map<string, { results: SearchResult[]; expiresAt: number }>())
  const request = useMemo(() => ({
    query,
    sources: query.includes("@") ? sources.filter(({ acceptsEmail }) => acceptsEmail) : sources,
  }), [query, sources])

  useEffect(() => {
    const { query, sources } = request
    if (query.length < 3) return
    const controller = new AbortController()
    const { signal } = controller
    const timer = window.setTimeout(() => {
      const updateGroup = (group: SearchGroup) => {
        if (signal.aborted) return
        setResponse((previous) => ({
          request,
          groups: [
            ...(previous?.request === request
              ? previous.groups.filter(({ label }) => label !== group.label)
              : []),
            group,
          ],
        }))
      }
      for (const { label, search, cacheable } of sources) {
        const cacheKey = JSON.stringify([label, query])
        const cached = cache.current.get(cacheKey)
        if (cached && cached.expiresAt > Date.now()) {
          updateGroup({ label, results: cached.results })
          continue
        }
        void search(query, signal).then(
          (results) => {
            if (signal.aborted) return
            if (cacheable) {
              const entries = cache.current
              entries.delete(cacheKey)
              if (entries.size >= CACHE_LIMIT) {
                const oldest = entries.keys().next().value
                if (oldest !== undefined) entries.delete(oldest)
              }
              entries.set(cacheKey, { results, expiresAt: Date.now() + CACHE_DURATION_MS })
            }
            updateGroup({ label, results })
          },
          (error: unknown) => {
            if (signal.aborted) return
            const status = error instanceof ApiError ? error.status : undefined
            if (status === 401) {
              onSessionExpired()
              return
            }
            const message = status === 429
              ? "Aguarde um instante para pesquisar novamente."
              : status === 403 || status === 404
                ? "Categoria indisponível neste acesso."
                : "Não foi possível pesquisar nesta categoria."
            updateGroup({ label, error: message })
          },
        )
      }
    }, 350)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [request, onSessionExpired])

  if (query.length < 3) return []
  const groups = response?.request === request ? response.groups : []
  const groupFor = (label: string) => groups.find((group) => group.label === label) ?? { label }
  const peopleGroups = uniquePeople(request.sources.filter(({ people }) => people).map(({ label }) => groupFor(label)))
  return request.sources.map(({ label }) =>
    peopleGroups.find((group) => group.label === label) ?? groupFor(label),
  )
}
