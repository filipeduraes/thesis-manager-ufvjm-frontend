import type { ReactNode } from "react"
import { PROFILE_PRIORITY } from "../../data/navigation"
import type { Page, Profile } from "../../types"
import AdminDashboard from "./AdminDashboard"
import AdvisorDashboard from "./AdvisorDashboard"
import CoordinatorDashboard from "./CoordinatorDashboard"
import StudentDashboard from "./StudentDashboard"

const SECTION_TITLES: Record<Profile, string> = {
  Administrador: "Administração",
  Coordenador: "Coordenação",
  Orientador: "Orientação",
  Aluno: "Minha monografia",
}

const SECTION_IDS: Record<Profile, string> = {
  Administrador: "dashboard-admin",
  Coordenador: "dashboard-coordinator",
  Orientador: "dashboard-advisor",
  Aluno: "dashboard-student",
}

interface DashboardViewProps {
  profiles: Profile[]
  go: (page: Page) => void
  review: (thesisId: string) => void
  evaluate: (defenseId: string) => void
}

export default function DashboardView({ profiles, go, review, evaluate }: DashboardViewProps) {
  // Quem tem vários cargos vê as seções de todos, na ordem de prioridade.
  const visibleProfiles = PROFILE_PRIORITY.filter((profile) => profiles.includes(profile))

  const renderDashboard = (profile: Profile): ReactNode => {
    if (profile === "Administrador") return <AdminDashboard go={go} />
    if (profile === "Coordenador") return <CoordinatorDashboard go={go} />
    if (profile === "Orientador") return <AdvisorDashboard go={go} review={review} evaluate={evaluate} />
    return <StudentDashboard go={go} />
  }

  if (visibleProfiles.length <= 1) {
    const singleProfile = visibleProfiles[0] ?? "Aluno"
    return <div className="page-content">{renderDashboard(singleProfile)}</div>
  }

  return (
    <div className="page-content">
      {visibleProfiles.map((profile) => (
        <section className="dashboard-section" aria-labelledby={SECTION_IDS[profile]} key={profile}>
          <h2 className="dashboard-section-title" id={SECTION_IDS[profile]}>
            {SECTION_TITLES[profile]}
          </h2>
          {renderDashboard(profile)}
        </section>
      ))}
    </div>
  )
}
