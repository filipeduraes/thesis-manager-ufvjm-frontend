import { useState } from "react"
import type { Page } from "../types"
import { Button, Icon, Logo } from "../components/common"

interface LoginViewProps {
  go: (page: Page) => void
  loginGoogle: () => Promise<void>
  exchangeToken: (token: string) => Promise<void>
  loading: boolean
  error: string
}

export default function LoginView({
  go,
  loginGoogle,
  exchangeToken,
  loading,
  error,
}: LoginViewProps) {
  const [token, setToken] = useState("")
  const [working, setWorking] = useState(false)
  const [localError, setLocalError] = useState("")

  const submitToken = async () => {
    setWorking(true)
    setLocalError("")
    try {
      await exchangeToken(token)
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : "Token inválido.")
    } finally {
      setWorking(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand">
        <Logo dark />
        <div className="brand-copy">
          <h1>Repositório e Gestão de Monografias</h1>
          <p>
            Sistema de submissão, avaliação e publicação de trabalhos de
            conclusão de curso.
          </p>
        </div>
        <div className="brand-footer">
          <span>Universidade Federal dos Vales do Jequitinhonha e Mucuri</span>
          <a
            href="https://portal.ufvjm.edu.br/"
            target="_blank"
            rel="noreferrer"
          >
            Acessar portal da UFVJM <Icon name="arrow" size={13} />
          </a>
        </div>
      </section>
      <section className="login-form-area">
        <div className="login-card">
          <h2 className="login-access-title">Login institucional</h2>
          <Button disabled={loading} onClick={loginGoogle}>
            {loading ? "Conectando…" : "Entrar com conta institucional"} <Icon name="arrow" size={16} />
          </Button>
          {(error || localError) && <p role="alert">{error || localError}</p>}
          <div className="divider">
            <span>ou</span>
          </div>
          <div className="token-box">
            <div>
              <strong>Sou membro de banca externo</strong>
              <p>Use o token temporário enviado por e-mail.</p>
            </div>
            <div className="token-row">
              <input
                value={token}
                onChange={(event) => setToken(event.target.value.toUpperCase())}
                placeholder="Ex.: UFVJM-ABCD-EFGH-IJKL-MNPQ"
                autoComplete="one-time-code"
              />
              <Button
                variant="secondary"
                disabled={!token.trim() || working}
                onClick={submitToken}
              >
                {working ? "Validando…" : "Acessar com token"}
              </Button>
            </div>
          </div>
          <button
            className="text-link repo-link"
            onClick={() => go("repository")}
          >
            Ir para o repositório público <Icon name="arrow" size={14} />
          </button>
        </div>
      </section>
    </main>
  )
}
