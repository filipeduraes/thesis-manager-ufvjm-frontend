import { ApiError } from "../../api/client"

/**
 * Message for a failed defense status action (start, close, cancel, revert).
 *
 * 403 and 404 share one neutral message: the backend answers 403 to a committee member
 * who cannot manage the defense and 404 to a user with no link to it.
 */
export function statusActionErrorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof ApiError && (reason.status === 403 || reason.status === 404)) {
    return "Você não tem permissão para esta ação."
  }
  if (reason instanceof ApiError && reason.status === 429) {
    return "Muitas requisições em sequência. Aguarde alguns instantes e tente novamente."
  }
  return reason instanceof Error && reason.message ? reason.message : fallback
}
