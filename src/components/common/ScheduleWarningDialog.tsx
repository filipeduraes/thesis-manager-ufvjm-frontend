import type { ScheduleWarning } from "../../api/client"
import Button from "./Button"
import Icon from "./Icon"
import Modal from "./Modal"

interface ScheduleWarningDialogProps {
  warnings: ScheduleWarning[]
  defenseStart: string
  defenseDurationMinutes: number
  onConfirm: () => void
  onCancel: () => void
}

const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
})

function describe(warning: ScheduleWarning): string {
  return `${warning.memberName} participa de outra banca em ${DATE_TIME.format(new Date(warning.scheduledDatetime))}.`
}

function distance(warning: ScheduleWarning, defenseStart: string, defenseDurationMinutes: number): string {
  const newStart = Date.parse(defenseStart)
  const newEnd = newStart + defenseDurationMinutes * 60_000
  const otherStart = Date.parse(warning.scheduledDatetime)
  const otherEnd = Date.parse(warning.scheduledEndDatetime)
  if (newStart >= otherEnd) {
    const minutes = Math.round((newStart - otherEnd) / 60_000)
    return `A nova banca começa ${minutes} minutos depois do término da outra banca.`
  }
  const minutes = Math.round((otherStart - newEnd) / 60_000)
  return `A nova banca termina ${minutes} minutos antes do início da outra banca.`
}

/** Pede confirmação antes de manter uma banca próxima de outra defesa do mesmo avaliador. */
export default function ScheduleWarningDialog({ warnings, defenseStart, defenseDurationMinutes, onConfirm, onCancel }: ScheduleWarningDialogProps) {
  return (
    <Modal onClose={onCancel} labelledBy="schedule-warning-title">
      <div className="section-head">
        <h2 id="schedule-warning-title">Possível conflito de horário</h2>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Fechar">
          <Icon name="close" />
        </button>
      </div>
      <div className="inline-alert" role="status">
        <Icon name="alert" />
        <span>O horário não bate com outra banca, mas está muito próximo. Atrasos podem atrapalhar a defesa.</span>
      </div>
      <ul className="schedule-warning-list">
        {warnings.map((warning, index) => (
          <li key={`${warning.defenseId}-${warning.memberName}-${index}`}>
            {describe(warning)} {distance(warning, defenseStart, defenseDurationMinutes)}
          </li>
        ))}
      </ul>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button onClick={onConfirm}>Continuar mesmo assim</Button>
      </div>
    </Modal>
  )
}
