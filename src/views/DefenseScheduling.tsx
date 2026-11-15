import { useEffect, useState } from "react"
import { ApiError, defenseApi } from "../api/client"
import { Badge, PageTitle } from "../components/common"
import DefenseScheduleForm from "./defense/DefenseScheduleForm"
import PresentedDefenseList, { type DefenseListState } from "./defense/PresentedDefenseList"

// Limite máximo aceito pelo backend (ThesisPagination.max_page_size).
const DEFENSE_LIST_PAGE_SIZE = 100

type DefenseView = "schedule" | "presented"

function listErrorMessage(reason: unknown): string {
  if (reason instanceof ApiError && reason.status === 403) {
    return "Você não tem permissão para consultar bancas."
  }
  if (reason instanceof ApiError && reason.status === 429) {
    return "Muitas requisições em sequência. Aguarde alguns instantes e tente novamente."
  }
  return reason instanceof Error && reason.message ? reason.message : "Não foi possível carregar as bancas."
}

interface DefenseSchedulingProps {
  onEvaluate: (defenseId: string) => void
  onOpenCommittee: (defenseId: string) => void
}

/**
 * Defense management screen: scheduling form and the list of visible defenses.
 *
 * The list is loaded here (not in the tab) so the tab counter can show the real total.
 */
export default function DefenseScheduling({ onEvaluate, onOpenCommittee }: DefenseSchedulingProps) {
  const [activeView, setActiveView] = useState<DefenseView>("schedule")
  const [listState, setListState] = useState<DefenseListState>({ status: "loading" })
  const [listReloadKey, setListReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setListState({ status: "loading" })
    defenseApi
      .list({ pageSize: DEFENSE_LIST_PAGE_SIZE })
      .then((response) => {
        if (!cancelled) setListState({ status: "ready", defenses: response.results, count: response.count })
      })
      .catch((reason: unknown) => {
        if (!cancelled) setListState({ status: "error", message: listErrorMessage(reason) })
      })
    return () => {
      cancelled = true
    }
  }, [listReloadKey])

  const reloadList = () => setListReloadKey((current) => current + 1)

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
          {listState.status === "ready" && <Badge tone="light">{listState.count}</Badge>}
        </button>
      </div>

      {activeView === "presented" ? (
        <PresentedDefenseList
          listState={listState}
          onRetry={reloadList}
          onEvaluate={onEvaluate}
          onOpenCommittee={onOpenCommittee}
        />
      ) : (
        <DefenseScheduleForm onOpenCommittee={onOpenCommittee} />
      )}
    </div>
  )
}
