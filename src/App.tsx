import { useEffect, useMemo, useState } from "react"
import { AppShell } from "./components/layout"
import { authApi, codeToProfile, type SessionPayload } from "./api/client"
import type { Page, Profile } from "./types"
import AdminCourses from "./views/AdminCourses"
import AdminUsers from "./views/AdminUsers"
import AdvisorApproval from "./views/AdvisorApproval"
import DefenseScheduling from "./views/DefenseScheduling"
import ExternalEvaluation from "./views/ExternalEvaluation"
import LoginView from "./views/LoginView"
import PublicRepository from "./views/PublicRepository"
import ReportsView from "./views/ReportsView"
import StudentSubmission from "./views/StudentSubmission"
import StyleGuideView from "./views/StyleGuideView"
import SystemAudit from "./views/SystemAudit"
import DashboardView from "./views/dashboard"

const routeTitles: Partial<Record<Page, string>> = {
  dashboard: "Início",
  submission: "Submissão",
  approval: "Orientandos",
  schedule: "Bancas",
  evaluation: "Avaliação",
  reports: "Relatórios",
  users: "Usuários",
  courses: "Cursos",
  audit: "Auditoria",
  style: "Guia de estilo",
}

export default function App() {
  const [page, setPage] = useState<Page>("login")
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [loginLoading, setLoginLoading] = useState(false)
  const [error, setError] = useState("")
  const [profile, setProfile] = useState<Profile>("Aluno")
  const [mobileMenu, setMobileMenu] = useState(false)
  const [reviewStudent, setReviewStudent] = useState<string>()
  const [evaluationDefense, setEvaluationDefense] = useState<string>()
  const [evaluatedDefenses, setEvaluatedDefenses] = useState<string[]>([])

  const title = useMemo(() => routeTitles[page] ?? "", [page])
  const availableProfiles = (session?.roles ?? []).map((role) =>
    codeToProfile(role.code),
  )

  const refreshSession = async () => {
    const current = await authApi.getSession()
    setSession(current)
    if (current.authenticated) {
      setProfile(codeToProfile(current.role))
      setPage(current.authType === "external" ? "evaluation" : "dashboard")
    } else {
      setPage("login")
    }
    return current
  }

  useEffect(() => {
    let mounted = true
    const authError = new URLSearchParams(window.location.search).get("erro")
    if (authError) setError("O acesso institucional não foi autorizado. Use sua conta Google Workspace da UFVJM.")
    authApi
      .getSession()
      .then((current) => {
        if (!mounted) return
        setSession(current)
        if (current.authenticated) {
          setProfile(codeToProfile(current.role))
          setPage(current.authType === "external" ? "evaluation" : "dashboard")
        }
      })
      .catch((reason: unknown) => {
        if (mounted) setError(reason instanceof Error ? reason.message : "Falha ao consultar a sessão.")
      })
      .finally(() => {
        if (mounted) setSessionLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const beginGoogleLogin = async () => {
    setLoginLoading(true)
    setError("")
    try {
      await authApi.beginGoogleLogin()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível iniciar o login.")
      setLoginLoading(false)
    }
  }

  const exchangeToken = async (token: string) => {
    await authApi.exchangeExternalToken(token)
    const current = await refreshSession()
    if (!current.authenticated) throw new Error("Não foi possível iniciar a sessão externa.")
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível encerrar a sessão no servidor.")
    } finally {
      setSession(null)
      setPage("login")
      setProfile("Aluno")
    }
  }

  const changeProfile = async (nextProfile: Profile) => {
    try {
      await authApi.setActiveProfile(nextProfile)
      setProfile(nextProfile)
      setReviewStudent(undefined)
      if (nextProfile === "Aluno" && page === "reports") setPage("dashboard")
      if (nextProfile !== "Administrador" && ["users", "courses", "audit", "style"].includes(page)) {
        setPage("dashboard")
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível trocar o perfil.")
    }
  }

  const navigate = (nextPage: Page) => {
    setReviewStudent(undefined)
    setPage(nextPage)
  }

  if (page === "repository") {
    return <PublicRepository go={setPage} />
  }

  if (sessionLoading) return <main className="login-page" aria-live="polite">Carregando sessão…</main>

  if (!session?.authenticated || !session.user) {
    return (
      <LoginView
        go={setPage}
        loginGoogle={beginGoogleLogin}
        exchangeToken={exchangeToken}
        loading={loginLoading}
        error={error}
      />
    )
  }

  if (session.authType === "external") {
    return (
      <ExternalEvaluation
        mode="external"
        goLogin={() => void logout()}
        goBack={() => void logout()}
        externalSession={session.externalInvitation}
      />
    )
  }

  return (
    <AppShell
      page={page}
      profile={profile}
      profiles={availableProfiles.length ? availableProfiles : [profile]}
      title={title}
      menuOpen={mobileMenu}
      navigate={navigate}
      logout={() => void logout()}
      setProfile={(nextProfile) => void changeProfile(nextProfile)}
      setMenuOpen={setMobileMenu}
      userName={session.user.name}
      userInitials={session.user.initials}
    >
      {error && <div className="success-notice" role="alert">{error}</div>}
      {page === "dashboard" && (
        <DashboardView
          profile={profile}
          go={navigate}
          review={(student) => {
            setReviewStudent(student)
            setPage("approval")
          }}
        />
      )}
      {page === "submission" && <StudentSubmission />}
      {page === "approval" && <AdvisorApproval initialStudent={reviewStudent} />}
      {page === "schedule" && (
        <DefenseScheduling
          canEvaluate={profile === "Orientador" || profile === "Coordenador"}
          evaluatedDefenseIds={evaluatedDefenses}
          onEvaluate={(defenseId) => {
            setEvaluationDefense(defenseId)
            setPage("evaluation")
          }}
        />
      )}
      {page === "evaluation" && (
        <ExternalEvaluation
          mode="internal"
          defenseId={evaluationDefense}
          goLogin={() => void logout()}
          goBack={() => setPage("schedule")}
          onSubmitted={(defenseId) => {
            if (defenseId) setEvaluatedDefenses((current) => current.includes(defenseId) ? current : [...current, defenseId])
          }}
        />
      )}
      {page === "reports" && <ReportsView />}
      {page === "users" && <AdminUsers />}
      {page === "courses" && <AdminCourses />}
      {page === "audit" && <SystemAudit />}
      {page === "style" && <StyleGuideView />}
    </AppShell>
  )
}
