import { useEffect, useRef, useState } from "react"
import type { KeyboardEvent } from "react"
import { ApiError, usersApi, type UserSuggestion } from "../../api/client"
import Avatar from "./Avatar"

const SUGGEST_DEBOUNCE_MS = 300
const MAX_CACHE_ENTRIES = 100

export interface UserSuggestInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  /** Normalization hook (ex.: complete the institucional domain on blur). */
  onBlur?: () => void
  onSelect: (user: UserSuggestion) => void
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
  autoFocus?: boolean
  required?: boolean
  /** Surfaces loading/result counts so parents can render their own hint text. */
  onSuggestionsChange?: (state: { query: string; loading: boolean; results: UserSuggestion[]; error: string }) => void
}

/**
 * Text input with a top-3 autocomplete of institutional users.
 *
 * Keyboard: ArrowUp/ArrowDown cycle, Enter selects the highlighted entry and
 * Escape closes the list (Enter also submits normally when nothing is
 * highlighted). Search starts at two characters after a 300 ms debounce;
 * identical prefixes hit a small in-memory cache instance cache, then the
 * short server-side cache, so typing stays cheap. Results are capped at three
 * by the backend.
 */
export default function UserSuggestInput({
  id,
  value,
  onChange,
  onBlur,
  onSelect,
  placeholder,
  autoComplete = "off",
  disabled = false,
  autoFocus = false,
  required = false,
  onSuggestionsChange,
}: UserSuggestInputProps) {
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [error, setError] = useState("")
  const cacheRef = useRef(new Map<string, UserSuggestion[]>())
  const requestIdRef = useRef(0)

  const query = value.trim()
  const listId = `${id}-listbox`
  const showList = open && query.length >= 2 && suggestions.length > 0

  useEffect(() => {
    if (query.length < 2) {
      requestIdRef.current += 1
      setSuggestions([])
      setLoading(false)
      return
    }
    const cached = cacheRef.current.get(query.toLowerCase())
    if (cached) {
      setSuggestions(cached)
      return
    }
    const requestId = ++requestIdRef.current
    const key = query.toLowerCase()
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError("")
      usersApi
        .suggest(query)
        .then(({ results }) => {
          if (requestId !== requestIdRef.current) return
          if (cacheRef.current.size >= MAX_CACHE_ENTRIES) {
            const oldest = cacheRef.current.keys().next().value
            if (oldest !== undefined) cacheRef.current.delete(oldest)
          }
          cacheRef.current.set(key, results)
          setSuggestions(results)
        })
        .catch((reason: unknown) => {
          if (requestId !== requestIdRef.current) return
          setSuggestions([])
          const forbidden = reason instanceof ApiError && reason.status === 403
          const fallback = reason instanceof Error ? reason.message : "Não foi possível buscar usuários."
          setError(
            forbidden
              ? "Busca de usuários disponível apenas para administradores, coordenadores e orientadores na rede institucional."
              : fallback,
          )
        })
        .finally(() => {
          if (requestId === requestIdRef.current) setLoading(false)
        })
    }, SUGGEST_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    onSuggestionsChange?.({ query, loading, results: suggestions, error })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, loading, suggestions, error])

  const selectOption = (user: UserSuggestion) => {
    onSelect(user)
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setOpen(true)
      if (suggestions.length === 0) return
      setActiveIndex((current) => (current >= suggestions.length - 1 ? 0 : current + 1))
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      setOpen(true)
      if (suggestions.length === 0) return
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1))
      return
    }
    if (event.key === "Enter" && showList && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault()
      selectOption(suggestions[activeIndex])
      return
    }
    if (event.key === "Escape" && open) {
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <div className="user-suggest">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setActiveIndex(-1)
          setError("")
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          onBlur?.()
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        autoFocus={autoFocus}
        required={required}
      />
      {showList && (
        <ul id={listId} className="user-suggest-list" role="listbox" aria-label="Sugestões de usuários">
          {suggestions.map((user, index) => (
            <li
              key={user.id}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`user-suggest-option${index === activeIndex ? " active" : ""}`}
              onMouseDown={(event) => {
                event.preventDefault()
                selectOption(user)
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <Avatar size="small" name={user.name} imageUrl={user.avatarUrl} />
              <span>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
