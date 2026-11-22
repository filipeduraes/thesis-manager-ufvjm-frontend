import { useEffect, useState } from "react"
import { ApiError, adminApi, type UserLookupResult } from "../api/client"

const INSTITUTIONAL_DOMAIN = "ufvjm.edu.br"
const LOOKUP_DEBOUNCE_MS = 400

/**
 * Normaliza o que o usuário digitou para o e-mail institucional.
 *
 * "usuario" vira "usuario@ufvjm.edu.br"; um valor que já contém "@" é
 * apenas recortado e normalizado. Entradas vazias devolvem "".
 */
export function normalizeInstitutionalEmail(value: string): string {
  const local = value.trim().toLowerCase()
  if (!local) return ""
  if (local.includes("@")) return local
  return `${local}@${INSTITUTIONAL_DOMAIN}`
}

interface UserLookupState {
  /** Resultado do backend; null quando não há e-mail válido ou a busca falhou. */
  lookup: UserLookupResult | null
  /** true enquanto a consulta debounced está em voo. */
  loading: boolean
  /** Mensagem amigável para exibir no campo; "" quando está tudo certo. */
  error: string
}

/**
 * Busca um usuário institucional pelo e-mail digitado, com debounce de 400 ms.
 *
 * Comportamento compartilhado pelo formulário de curso e pelo modal de
 * membro institucional: o usuário não precisa digitar o domínio e não
 * precisa clicar em um botão "Buscar". O endpoint é restrito a administradores
 * na rede institucional; para outros perfis a mensagem de erro é repassada.
 */
export function useUserLookup(rawEmail: string): UserLookupState {
  const [lookup, setLookup] = useState<UserLookupResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const email = normalizeInstitutionalEmail(rawEmail)
    if (!email) {
      setLoading(false)
      setLookup(null)
      setError("")
      return
    }
    let active = true
    setLoading(false)
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const result = await adminApi.lookupUser(email)
        if (!active) return
        setLookup(result)
        setError("")
      } catch (reason: unknown) {
        if (!active) return
        setLookup(null)
        const forbidden = reason instanceof ApiError && reason.status === 403
        const fallback = reason instanceof Error ? reason.message : "Não foi possível buscar o usuário."
        setError(
          forbidden
            ? "Busca de usuários disponível apenas para administradores na rede institucional."
            : fallback,
        )
      } finally {
        if (active) setLoading(false)
      }
    }, LOOKUP_DEBOUNCE_MS)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [rawEmail])

  return { lookup, loading, error }
}
