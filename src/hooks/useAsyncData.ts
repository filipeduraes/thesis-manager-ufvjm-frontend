import { useCallback, useEffect, useState } from "react"
import { ApiError } from "../api/client"

export type AsyncStatus = "loading" | "error" | "ready"

export interface AsyncData<T> {
  status: AsyncStatus
  /** Last successful value; kept while a new request is loading so filters and layout do not flicker. */
  value: T | undefined
  error: unknown
  reload: () => void
}

interface AsyncSnapshot<T> {
  status: AsyncStatus
  value: T | undefined
  error: unknown
}

/**
 * Runs `loader` on mount and whenever it changes (wrap it in `useCallback`),
 * exposing loading/error/ready states and a `reload` callback.
 *
 * Responses from a superseded or unmounted request are ignored, so changing
 * filters quickly never shows out-of-order data.
 */
export function useAsyncData<T>(loader: () => Promise<T>): AsyncData<T> {
  const [snapshot, setSnapshot] = useState<AsyncSnapshot<T>>({ status: "loading", value: undefined, error: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setSnapshot((previous) => ({ status: "loading", value: previous.value, error: null }))
    loader().then(
      (value) => {
        if (active) setSnapshot({ status: "ready", value, error: null })
      },
      (error: unknown) => {
        if (active) setSnapshot((previous) => ({ status: "error", value: previous.value, error }))
      },
    )
    return () => {
      active = false
    }
  }, [loader, attempt])

  const reload = useCallback(() => setAttempt((current) => current + 1), [])
  return { ...snapshot, reload }
}

/**
 * Converts a failed request into a user-facing message in Portuguese,
 * with explicit wording for missing permission (403) and rate limiting (429).
 */
export function loadErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "Você não tem permissão para ver estes dados."
    if (error.status === 429) return "Muitas consultas em pouco tempo. Aguarde um instante e tente novamente."
    return error.message || fallback
  }
  return fallback
}
