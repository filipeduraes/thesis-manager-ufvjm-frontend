import { useEffect, useState } from "react"
import { defenseApi } from "../api/client"
import { Badge, PageTitle } from "../components/common"
import DefenseScheduleForm from "./defense/DefenseScheduleForm"
import PresentedDefenseList from "./defense/PresentedDefenseList"

type DefenseView = "schedule" | "presented"

const DEFENSE_VIEW_STORAGE_KEY = "ufvjm:defense-view"

function initialDefenseView(): DefenseView {
  const stored = window.sessionStorage.getItem(DEFENSE_VIEW_STORAGE_KEY)
  return stored === "presented" || stored === "schedule" ? stored : "schedule"
}

interface DefenseSchedulingProps {
  onEvaluate: (defenseId: string) => void
  onOpenCommittee: (defenseId: string) => void
}

/**
 * Defense management screen: scheduling form and the list of visible defenses.
 *
 * The tab counter shows the unfiltered total, fetched here with `pageSize=1` so it is
 * available before the list tab is opened and does not change with the list filters.
 */
export default function DefenseScheduling({ onEvaluate, onOpenCommittee }: DefenseSchedulingProps) {
  const [activeView, setActiveView] = useState<DefenseView>(initialDefenseView)
  // null enquanto carrega ou se a contagem falhar; a lista mostra o próprio erro.
  const [totalCount, setTotalCount] = useState<number | null>(null)

  useEffect(() => {
    window.sessionStorage.setItem(DEFENSE_VIEW_STORAGE_KEY, activeView)
  }, [activeView])

  useEffect(() => {
    let cancelled = false
    defenseApi
      .list({ pageSize: 1 })
      .then((response) => {
        if (!cancelled) setTotalCount(response.count)
      })
      .catch(() => {
        if (!cancelled) setTotalCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="Gestão de bancas"
        title={activeView === "schedule" ? "Agendar banca de defesa" : "Bancas"}
      />
      <div className="defense-tabs" role="tablist">
        <button
          className={activeView === "schedule" ? "active" : ""}
          onClick={() => setActiveView("schedule")}
          role="tab"
          aria-selected={activeView === "schedule"}
        >
          Agendamento
        </button>
        <button
          className={activeView === "presented" ? "active" : ""}
          onClick={() => setActiveView("presented")}
          role="tab"
          aria-selected={activeView === "presented"}
        >
          Bancas
          {totalCount !== null && <Badge tone="light">{totalCount}</Badge>}
        </button>
      </div>

      {activeView === "presented" ? (
        <PresentedDefenseList onEvaluate={onEvaluate} onOpenCommittee={onOpenCommittee} />
      ) : (
        <DefenseScheduleForm onOpenCommittee={onOpenCommittee} />
      )}
    </div>
  )
}
