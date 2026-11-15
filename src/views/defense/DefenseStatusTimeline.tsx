import type { DefenseStatusHistoryEntry } from "../../api/client"
import { Icon } from "../../components/common"

const HISTORY_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
})

interface TimelineStep {
  key: string
  label: string
  state: "done" | "current" | "cancelled" | "pending"
  /** Step that matches the current status (also true for a completed final step). */
  isCurrent: boolean
}

/**
 * Builds the progress steps from the current status alone, so defenses created before
 * the history existed still show where they are.
 */
export function defenseTimelineSteps(status: string): TimelineStep[] {
  if (status === "CANCELLED") {
    return [
      { key: "SCHEDULED", label: "Agendada", state: "done", isCurrent: false },
      { key: "CANCELLED", label: "Cancelada", state: "cancelled", isCurrent: true },
    ]
  }
  const order = ["SCHEDULED", "IN_PROGRESS", "COMPLETED"]
  const labels: Record<string, string> = { SCHEDULED: "Agendada", IN_PROGRESS: "Em andamento", COMPLETED: "Concluída" }
  const currentIndex = order.indexOf(status)
  return order.map((key, index) => {
    // Banca concluída: todas as etapas estão feitas.
    const finished = status === "COMPLETED"
    let state: TimelineStep["state"] = "pending"
    if (finished || index < currentIndex) state = "done"
    else if (index === currentIndex) state = "current"
    return { key, label: labels[key] ?? key, state, isCurrent: index === currentIndex }
  })
}

const STEP_STATE_TEXT: Record<TimelineStep["state"], string> = {
  done: "etapa concluída",
  current: "etapa atual",
  cancelled: "banca cancelada",
  pending: "etapa futura",
}

interface DefenseStatusTimelineProps {
  status: string
  history: DefenseStatusHistoryEntry[]
}

/**
 * Status progress (Agendada → Em andamento → Concluída, or → Cancelada) and the
 * chronological status history returned by `GET /api/v1/defenses/{id}`.
 *
 * Reuses the `.steps` progress and `.timeline` history patterns from the thesis screens.
 */
export default function DefenseStatusTimeline({ status, history }: DefenseStatusTimelineProps) {
  const steps = defenseTimelineSteps(status)

  return (
    <>
      <ol className="steps defense-steps" aria-label="Etapas da banca">
        {steps.map((step, index) => {
          return (
            <li className={`step ${step.state}`} key={step.key} aria-current={step.isCurrent ? "step" : undefined}>
              <span aria-hidden="true">
                {step.state === "done" && <Icon name="check" size={13} />}
                {step.state === "cancelled" && <Icon name="close" size={13} />}
                {(step.state === "current" || step.state === "pending") && index + 1}
              </span>
              <small>
                {step.label}
                <span className="sr-only"> ({STEP_STATE_TEXT[step.state]})</span>
              </small>
            </li>
          )
        })}
      </ol>

      <h3 className="defense-history-title">Histórico</h3>
      {history.length === 0 ? (
        <p className="defense-history-empty">Sem histórico registrado para esta banca.</p>
      ) : (
        // .timeline estiliza filhos <div>, por isso a lista usa roles em vez de <ol>/<li>.
        <div className="timeline defense-history" role="list" aria-label="Histórico de status">
          {history.map((entry, index) => {
            const isLatest = index === history.length - 1
            const transition = entry.previousStatusLabel
              ? `${entry.previousStatusLabel} → ${entry.newStatusLabel}`
              : entry.newStatusLabel
            return (
              <div role="listitem" className={isLatest ? "current" : ""} key={`${entry.createdAt}-${entry.newStatus}`}>
                <span aria-hidden="true">{isLatest ? <Icon name="check" size={12} /> : index + 1}</span>
                <div>
                  <strong>{transition}</strong>
                  <small>
                    {HISTORY_FORMATTER.format(new Date(entry.createdAt))} · {entry.changedBy ?? "Sistema"}
                  </small>
                  {entry.reason && <small>{entry.reason}</small>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
