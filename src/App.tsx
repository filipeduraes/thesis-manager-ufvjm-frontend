import { useMemo, useState } from "react"
import { AppShell } from "./components/layout"
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
  // TODO: API Integration - GET /api/v1/session
  // Response: { profile: Profile, permissions: string[] }
  const [page, setPage] = useState<Page>("login")
  const [profile, setProfile] = useState<Profile>("Aluno")
  const [mobileMenu, setMobileMenu] = useState(false)
  const [reviewStudent, setReviewStudent] = useState<string>()
  const [evaluationMode, setEvaluationMode] = useState<"external" | "internal">(
    "external",
  )
  const [evaluationDefense, setEvaluationDefense] = useState<string>()
  const [evaluatedDefenses, setEvaluatedDefenses] = useState<string[]>([])

  const title = useMemo(() => routeTitles[page] ?? "", [page])

  // TODO: API Integration - PATCH /api/v1/session/active-profile
  // Request: { profile: Profile }; Response: { profile: Profile }
  const changeProfile = (nextProfile: Profile) => {
    setProfile(nextProfile)
    setReviewStudent(undefined)

    if (nextProfile === "Aluno" && page === "reports") {
      setPage("dashboard")
    }

    if (
      nextProfile !== "Administrador" &&
      ["users", "courses", "audit", "style"].includes(page)
    ) {
      setPage("dashboard")
    }
  }

  // TODO: API Integration - route transitions will consume server-provided
  // authorization metadata from GET /api/v1/session.
  const navigate = (nextPage: Page) => {
    setReviewStudent(undefined)
    setPage(nextPage)
  }

  if (page === "login") {
    return (
      <LoginView
        go={(nextPage) => {
          if (nextPage === "evaluation") {
            setEvaluationMode("external")
            setEvaluationDefense(undefined)
          }
          setPage(nextPage)
        }}
      />
    )
  }

  if (page === "repository") {
    return <PublicRepository go={setPage} />
  }

  if (page === "evaluation") {
    return (
      <ExternalEvaluation
        mode={evaluationMode}
        defenseId={evaluationDefense}
        goLogin={() => setPage("login")}
        goBack={() => setPage("schedule")}
        onSubmitted={(defenseId) => {
          if (defenseId) {
            setEvaluatedDefenses((current) =>
              current.includes(defenseId) ? current : [...current, defenseId],
            )
          }
        }}
      />
    )
  }

  return (
    <AppShell
      page={page}
      profile={profile}
      title={title}
      menuOpen={mobileMenu}
      navigate={navigate}
      logout={() => setPage("login")}
      setProfile={changeProfile}
      setMenuOpen={setMobileMenu}
    >
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
      {page === "approval" && (
        <AdvisorApproval initialStudent={reviewStudent} />
      )}
      {page === "schedule" && (
        <DefenseScheduling
          canEvaluate={profile === "Orientador" || profile === "Coordenador"}
          evaluatedDefenseIds={evaluatedDefenses}
          onEvaluate={(defenseId) => {
            setEvaluationMode("internal")
            setEvaluationDefense(defenseId)
            setPage("evaluation")
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
