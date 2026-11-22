import { useCallback, useEffect, useState } from "react"
import { repositoryApi } from "../api/client"
import { apiErrorMessage } from "../api/errors"

export interface RepositoryCourseOption {
  value: string
  label: string
}

export interface RepositoryCoursesState {
  options: RepositoryCourseOption[]
  loading: boolean
  error: string
  retry: () => void
}

/**
 * Loads the institution's courses (`GET /api/v1/public/courses`) for repository forms.
 *
 * The list is public and not scoped: the backend refuses (403) entries in a course
 * the coordinator does not manage, and that message is shown by the form.
 */
export function useRepositoryCourses(): RepositoryCoursesState {
  const [options, setOptions] = useState<RepositoryCourseOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError("")
    repositoryApi
      .courses(controller.signal)
      .then(({ results }) => {
        if (controller.signal.aborted) return
        setOptions(results.map((course) => ({ value: course.id, label: `${course.name} (${course.code})` })))
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(apiErrorMessage(reason, "Não foi possível carregar os cursos."))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [attempt])

  const retry = useCallback(() => setAttempt((current) => current + 1), [])
  return { options, loading, error, retry }
}
