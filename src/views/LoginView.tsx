import { useEffect, useRef, useState } from "react"
import type { ClipboardEvent, FormEvent } from "react"
import type { Page } from "../types"
import { ApiError, authApi, type DevUser } from "../api/client"
import { Button, Icon, Logo, RoleMultiSelect } from "../components/common"
import {
  EXTERNAL_TOKEN_PREFIX,
  buildExternalToken,
  formatExternalTokenCode,
  isExternalTokenComplete,
} from "../data/externalToken"

interface LoginViewProps {
  go: (page: Page) => void
  loginGoogle: () => Promise<void>
  exchangeToken: (token: string) => Promise<void>
  loginDev?: (payload: { name: string; email: string; roles: string[] }) => Promise<void>
  loading: boolean
  error: string
}

/** Pausa após 429 para o formulário não reenviar o token em sequência (limite de 10/min no backend). */
const TOKEN_COOLDOWN_SECONDS = 15

function tokenErrorMessage(reason: unknown): string {
  if (reason instanceof ApiError && reason.status === 429) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns segundos e tente novamente."
  }
  if (reason instanceof ApiError && reason.status >= 500) {
    return "O serviço está indisponível no momento. Tente novamente em instantes."
  }
  if (reason instanceof Error && reason.message) return reason.message
  return "Não foi possível validar o token. Confira o código e tente novamente."
}

const DEV_ROLE_OPTIONS = [
  { value: "STUDENT", label: "Aluno" },
  { value: "ADVISOR", label: "Orientador" },
  { value: "COORDINATOR", label: "Coordenador" },
  { value: "ADMIN", label: "Administrador" },
]

export default function LoginView({
  go,
  loginGoogle,
  exchangeToken,
  loginDev,
  loading,
  error,
}: LoginViewProps) {
  const [tokenCode, setTokenCode] = useState("")
  const [working, setWorking] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [tokenError, setTokenError] = useState("")
  const [localError, setLocalError] = useState("")
  const tokenInputRef = useRef<HTMLInputElement>(null)
  const [devOpen, setDevOpen] = useState(false)
  const [devUsers, setDevUsers] = useState<DevUser[]>([])
  const [devName, setDevName] = useState("")
  const [devEmail, setDevEmail] = useState("")
  const [devRoles, setDevRoles] = useState<string[]>(["STUDENT"])
  const [devWorking, setDevWorking] = useState(false)
  const isDevBuild = process.env.NODE_ENV === "development"

  useEffect(() => {
    if (!isDevBuild || !devOpen) return
    let mounted = true
    authApi
      .listDevUsers()
      .then((data) => {
        if (mounted) setDevUsers(data.results ?? [])
      })
      .catch(() => {
        if (mounted) setDevUsers([])
      })
    return () => {
      mounted = false
    }
  }, [devOpen, isDevBuild])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const tokenComplete = isExternalTokenComplete(tokenCode)
  const tokenBlocked = working || cooldown > 0

  const changeToken = (rawValue: string) => {
    setTokenCode(formatExternalTokenCode(rawValue))
    setTokenError("")
  }

  // Colar o token completo (com prefixo) não pode ser truncado pelo campo.
  const pasteToken = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    changeToken(event.clipboardData.getData("text"))
  }

  const submitToken = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (tokenBlocked) return
    if (!tokenComplete) {
      setTokenError("Informe o token completo: são 16 letras e números, em quatro blocos de quatro.")
      tokenInputRef.current?.focus()
      return
    }
    setWorking(true)
    setTokenError("")
    try {
      await exchangeToken(buildExternalToken(tokenCode))
      setTokenCode("")
    } catch (reason) {
      setTokenError(tokenErrorMessage(reason))
      if (reason instanceof ApiError && reason.status === 429) setCooldown(TOKEN_COOLDOWN_SECONDS)
      tokenInputRef.current?.focus()
    } finally {
      setWorking(false)
    }
  }

  const selectDevUser = (value: string) => {
    if (!value) return
    const user = devUsers.find((item) => item.id === value)
    if (!user) return
    setDevName(user.name)
    setDevEmail(user.email)
    const nextRoles =
      user.roles && user.roles.length > 0
        ? user.roles
        : user.roleCode
          ? [user.roleCode]
          : ["STUDENT"]
    setDevRoles(nextRoles)
  }

  const submitDevLogin = async () => {
    if (!loginDev) return
    if (devRoles.length === 0) {
      setLocalError("Selecione ao menos um papel.")
      return
    }
    setDevWorking(true)
    setLocalError("")
    try {
      await loginDev({
        name: devName.trim(),
        email: devEmail.trim(),
        roles: devRoles,
      })
    } catch (reason) {
      setLocalError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível autenticar o usuário de teste.",
      )
    } finally {
      setDevWorking(false)
    }
  }

  const activeError = error || localError

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
            {loading ? "Conectando…" : "Entrar com conta institucional"}{" "}
            <Icon name="arrow" size={16} />
          </Button>
          {activeError && <p role="alert">{activeError}</p>}

          {isDevBuild && loginDev && (
            <>
              <div className="divider">
                <span>desenvolvimento</span>
              </div>
              <div className="token-box dev-login-box">
                <div className="dev-login-head">
                  <div>
                    <strong>Usuário de teste</strong>
                    <p>Disponível apenas em builds de desenvolvimento.</p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setDevOpen((open) => !open)}
                  >
                    {devOpen ? "Ocultar" : "Entrar com usuário de teste"}
                  </Button>
                </div>
                {devOpen && (
                  <div className="dev-login-form">
                    {devUsers.length > 0 && (
                      <label className="field">
                        <span>Usuário existente</span>
                        <select
                          defaultValue=""
                          onChange={(event) => selectDevUser(event.target.value)}
                        >
                          <option value="">Selecionar usuário de teste…</option>
                          {devUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} ({user.email})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="field">
                      <span>Nome</span>
                      <input
                        value={devName}
                        onChange={(event) => setDevName(event.target.value)}
                        placeholder="Nome do usuário de teste"
                        autoComplete="name"
                      />
                    </label>
                    <label className="field">
                      <span>E-mail</span>
                      <input
                        value={devEmail}
                        onChange={(event) => setDevEmail(event.target.value)}
                        placeholder="usuario@exemplo.local"
                        autoComplete="email"
                        inputMode="email"
                      />
                    </label>
                    <div className="field">
                      <span>Papéis</span>
                      <RoleMultiSelect
                        options={DEV_ROLE_OPTIONS}
                        value={devRoles}
                        onChange={setDevRoles}
                        ariaLabel="Papéis do usuário de teste"
                      />
                      <small>Aluno é exclusivo; os demais papéis administrativos podem ser combinados.</small>
                    </div>
                    <Button
                      disabled={devWorking || loading}
                      onClick={submitDevLogin}
                    >
                      {devWorking ? "Autenticando…" : "Entrar como usuário de teste"}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="divider">
            <span>ou</span>
          </div>
          <form className="token-box" onSubmit={(event) => void submitToken(event)} noValidate>
            <div>
              <strong id="external-token-title">Sou membro de banca externo</strong>
              <p id="external-token-help">
                Digite ou cole o token temporário enviado por e-mail. O prefixo {EXTERNAL_TOKEN_PREFIX} já está
                preenchido.
              </p>
            </div>
            <div className="token-row">
              <label className="sr-only" htmlFor="external-token-input">
                Token de acesso da banca
              </label>
              <div className="token-input">
                <span className="token-prefix" aria-hidden="true">
                  {EXTERNAL_TOKEN_PREFIX}-
                </span>
                <input
                  id="external-token-input"
                  ref={tokenInputRef}
                  value={tokenCode}
                  onChange={(event) => changeToken(event.target.value)}
                  onPaste={pasteToken}
                  placeholder="ABCD-EFGH-JKLM-NPQR"
                  autoComplete="one-time-code"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="text"
                  aria-describedby={tokenError ? "external-token-help external-token-error" : "external-token-help"}
                  aria-invalid={tokenError ? true : undefined}
                />
              </div>
              <Button type="submit" variant="secondary" disabled={tokenBlocked}>
                {working
                  ? "Validando…"
                  : cooldown > 0
                    ? `Aguarde ${cooldown}s`
                    : "Acessar com token"}
              </Button>
            </div>
            {tokenError && (
              <div className="form-error" id="external-token-error" role="alert">
                <Icon name="alert" size={16} />
                <span>{tokenError}</span>
              </div>
            )}
          </form>
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
