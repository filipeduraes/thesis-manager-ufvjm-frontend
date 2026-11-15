import { useEffect, useMemo, useState } from "react"
import { AppShell } from "./components/layout"
import { authApi, codeToProfile, type SessionPayload } from "./api/client"
import { menuByProfile, menuForProfiles, profilesFromCodes } from "./data/navigation"
import type { Page } from "./types"
import AdminCourses from "./views/AdminCourses"
import AdminUsers from "./views/AdminUsers"
import AdvisorApproval from "./views/AdvisorApproval"
import DefenseCommittee from "./views/DefenseCommittee"
import DefenseEvaluation from "./views/DefenseEvaluation"
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
  committee: "Gerenciar banca",
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
  const [mobileMenu, setMobileMenu] = useState(false)
  const [reviewThesisId, setReviewThesisId] = useState<string>()
  const [evaluationDefense, setEvaluationDefense] = useState<string>()
  const [committeeDefenseId, setCommitteeDefenseId] = useState<string>()

  const roleCodeKey = session?.user?.roles?.map((role) => role.code).join("|") ?? ""
  const userRoleCode = session?.user?.roleCode
  const activeProfiles = useMemo(() => {
    const fromRoles = profilesFromCodes(roleCodeKey ? roleCodeKey.split("|") : [])
    if (fromRoles.length > 0) return fromRoles
    return [codeToProfile(userRoleCode)]
  }, [roleCodeKey, userRoleCode])
  const profile = activeProfiles[0] ?? "Aluno"
  const profileLabel = activeProfiles.join(", ") || session?.user?.roleLabel || "Aluno"
  const menuItems = useMemo(() => menuForProfiles(activeProfiles), [activeProfiles])
  const showSearch = activeProfiles.some((item) => item !== "Aluno")
  const canEvaluate = activeProfiles.includes("Orientador") || activeProfiles.includes("Coordenador")
  const isAdmin = activeProfiles.includes("Administrador")
  // Admin ou coordenador. O orientador da própria tese também pode iniciar, encerrar,
  // cancelar e editar (_can_manage_defense); DefenseCommittee confirma isso via GET /theses/<id>.
  const canStartClose = isAdmin || activeProfiles.includes("Coordenador")

  const allowedPages = useMemo(() => {
    const pages = new Set<Page>()
    for (const item of menuItems) pages.add(item.page)
    for (const activeProfile of activeProfiles) {
      for (const item of menuByProfile[activeProfile] ?? []) pages.add(item.page)
    }
    // Avaliação e membros são abertos a partir da lista de bancas; quem pode agir é
    // decidido pelo backend (viewerMembership, _can_manage_defense), então as páginas
    // precisam estar liberadas para todo perfil que acessa "schedule".
    if (canEvaluate || pages.has("schedule")) pages.add("evaluation")
    if (pages.has("schedule")) pages.add("committee")
    return pages
  }, [activeProfiles, canEvaluate, menuItems])

  const title = useMemo(() => {
    const menuItem = menuItems.find((item) => item.page === page)
    return menuItem?.label ?? routeTitles[page] ?? ""
  }, [menuItems, page])

  const refreshSession = async () => {
    const current = await authApi.getSession()
    setSession(current)
    if (current.authenticated) {
      setPage(current.authType === "external" ? "evaluation" : "dashboard")
    } else {
      setPage("login")
    }
    return current
  }

  useEffect(() => {
    let mounted = true
    const params = new URLSearchParams(window.location.search)
    const authError = params.get("erro")
    if (authError) {
      setError("O acesso institucional não foi autorizado. Use sua conta Google Workspace da UFVJM.")
      params.delete("erro")
      const nextSearch = params.toString()
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`
      window.history.replaceState({}, "", nextUrl)
    }
    authApi
      .getSession()
      .then((current) => {
        if (!mounted) return
        setSession(current)
        if (current.authenticated) {
          setPage(current.authType === "external" ? "evaluation" : "dashboard")
          if (authError) setError("")
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

  useEffect(() => {
    if (!session?.authenticated || session.authType === "external") return
    if (!allowedPages.has(page)) setPage("dashboard")
  }, [allowedPages, page, session?.authenticated, session?.authType])

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
    }
  }

  const navigate = (nextPage: Page) => {
    setReviewThesisId(undefined)
    setPage(allowedPages.has(nextPage) ? nextPage : "dashboard")
  }

  const openCommittee = (defenseId: string) => {
    setCommitteeDefenseId(defenseId)
    setPage("committee")
  }

  const openEvaluation = (defenseId: string) => {
    setEvaluationDefense(defenseId)
    navigate("evaluation")
  }

  const openReview = (thesisId: string) => {
    setReviewThesisId(thesisId)
    setPage(allowedPages.has("approval") ? "approval" : "dashboard")
  }

  if (page === "repository") {
    return <PublicRepository go={setPage} />
  }

  if (sessionLoading) return <main className="login-page" aria-live="polite">Carregando sessão…</main>

  const loginDev = async (payload: {
    name: string
    email: string
    roles: string[]
  }) => {
    setLoginLoading(true)
    setError("")
    try {
      const sessionPayload = await authApi.devLogin(payload)
      setSession(sessionPayload)
      if (sessionPayload.authenticated) {
        setPage(sessionPayload.authType === "external" ? "evaluation" : "dashboard")
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível autenticar o usuário de teste.",
      )
      throw reason
    } finally {
      setLoginLoading(false)
    }
  }

  if (!session?.authenticated || !session.user) {
    return (
      <LoginView
        go={setPage}
        loginGoogle={beginGoogleLogin}
        exchangeToken={exchangeToken}
        loginDev={loginDev}
        loading={loginLoading}
        error={error}
      />
    )
  }

  if (session.authType === "external") {
    return (
      <ExternalEvaluation goLogin={() => void logout()} externalSession={session.externalInvitation} />
    )
  }

  return (
    <AppShell
      page={page}
      profileLabel={profileLabel}
      menuItems={menuItems}
      showSearch={showSearch}
      title={title}
      menuOpen={mobileMenu}
      navigate={navigate}
      logout={() => void logout()}
      setMenuOpen={setMobileMenu}
      userName={session.user.name}
      userInitials={session.user.initials}
      userAvatarUrl={session.user.avatarUrl}
    >
      {error && <div className="success-notice" role="alert">{error}</div>}
      {page === "dashboard" && (
        <DashboardView
          profile={profile}
          go={navigate}
          review={openReview}
        />
      )}
      {page === "submission" && <StudentSubmission />}
      {page === "approval" && <AdvisorApproval initialThesisId={reviewThesisId} profile={profile} />}
      {page === "schedule" && (
        <DefenseScheduling onEvaluate={openEvaluation} onOpenCommittee={openCommittee} />
      )}
      {page === "evaluation" && evaluationDefense && session.user && (
        <DefenseEvaluation
          defenseId={evaluationDefense}
          userEmail={session.user.email}
          goBack={() => navigate("schedule")}
        />
      )}
      {page === "committee" && committeeDefenseId && (
        <DefenseCommittee
          defenseId={committeeDefenseId}
          goBack={() => navigate("schedule")}
          isAdmin={isAdmin}
          canStartClose={canStartClose}
          isAdvisor={activeProfiles.includes("Orientador")}
          currentUserId={session.user.id}
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
