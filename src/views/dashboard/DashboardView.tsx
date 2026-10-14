import type { Page, Profile } from "../../types"
import AdminDashboard from "./AdminDashboard"
import AdvisorDashboard from "./AdvisorDashboard"
import CoordinatorDashboard from "./CoordinatorDashboard"
import StudentDashboard from "./StudentDashboard"
interface DashboardViewProps {
  profile: Profile
  go: (page: Page) => void
  review: (student: string) => void
}
export default function DashboardView({
  profile,
  go,
  review,
}: DashboardViewProps) {
  return (
    <main className="page-content">
      {profile === "Aluno" && <StudentDashboard go={go} />}{" "}
      {profile === "Orientador" && <AdvisorDashboard go={go} review={review} />}{" "}
      {profile === "Coordenador" && <CoordinatorDashboard go={go} />}{" "}
      {profile === "Administrador" && <AdminDashboard go={go} />}
    </main>
  )
}
