import { useState } from "react"
import { defenseApi, type DefenseCommitteeMember } from "../../api/client"
import { Badge, Button, Icon } from "../../components/common"
import { availabilityStatusBadge } from "../../data/defenseStatus"
import DefenseStatusConfirmModal from "./DefenseStatusConfirmModal"
import { statusActionErrorMessage } from "./defenseErrors"

interface DefenseAvailabilityResponseProps {
  defenseId: string
  /** Committee member that represents the signed-in user (institutional or external). */
  member: DefenseCommitteeMember
  /** Called after the backend records the answer; the parent reloads the defense. */
  onResponded: () => void
}

/**
 * Lets a committee member confirm or decline availability for a scheduled defense
 * through `POST /api/v1/defenses/{id}/members/{memberId}/availability`.
 *
 * A pending member sees a notice with both answers; a member who already answered
 * sees only their own badge and the option to change the answer. The backend accepts
 * only the member's own answer and only while the defense is SCHEDULED; the parent
 * renders this component only in that case.
 */
export default function DefenseAvailabilityResponse({ defenseId, member, onResponded }: DefenseAvailabilityResponseProps) {
  const [confirming, setConfirming] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [confirmError, setConfirmError] = useState("")
  const [declineError, setDeclineError] = useState("")
  const isPending = member.availabilityStatus !== "CONFIRMED" && member.availabilityStatus !== "DECLINED"
  const badge = availabilityStatusBadge(member.availabilityStatus)
  const showConfirm = member.availabilityStatus !== "CONFIRMED"
  const showDecline = member.availabilityStatus !== "DECLINED"

  const confirmAvailability = async () => {
    setConfirming(true)
    setConfirmError("")
    try {
      await defenseApi.respondAvailability(defenseId, member.id, { status: "CONFIRMED" })
      onResponded()
    } catch (reason) {
      setConfirmError(statusActionErrorMessage(reason, "Não foi possível confirmar a disponibilidade."))
    } finally {
      setConfirming(false)
    }
  }

  const declineAvailability = async (note: string) => {
    setDeclining(true)
    setDeclineError("")
    try {
      await defenseApi.respondAvailability(defenseId, member.id, { status: "DECLINED", note })
      setDeclineOpen(false)
      onResponded()
    } catch (reason) {
      setDeclineError(statusActionErrorMessage(reason, "Não foi possível informar a indisponibilidade."))
    } finally {
      setDeclining(false)
    }
  }

  return (
    <div className="availability-response">
      {isPending ? (
        <div className="conflict-message availability-pending" role="status">
          <Icon name="clock" />
          <div>
            <strong>Você ainda não confirmou sua disponibilidade para esta banca.</strong>
          </div>
        </div>
      ) : (
        <div className="availability-current">
          <span>Sua resposta:</span>
          <Badge tone={badge.tone}>{badge.label}</Badge>
          {member.availabilityStatus === "DECLINED" && member.availabilityNote && (
            <small>Observação: {member.availabilityNote}</small>
          )}
        </div>
      )}

      {confirmError && (
        <div className="success-notice" role="alert">
          {confirmError}
        </div>
      )}

      <div className="defense-actions availability-actions">
        {showConfirm && (
          <Button variant="success" disabled={confirming} onClick={() => void confirmAvailability()}>
            {confirming ? "Confirmando…" : "Confirmar disponibilidade"}
          </Button>
        )}
        {showDecline && (
          <Button variant="danger" disabled={confirming} onClick={() => setDeclineOpen(true)}>
            Informar indisponibilidade
          </Button>
        )}
      </div>

      {declineOpen && (
        <DefenseStatusConfirmModal
          title="Informar indisponibilidade?"
          description="A coordenação e o orientador verão que você não pode participar neste horário. A banca só pode ser iniciada quando todos os membros titulares confirmarem."
          confirmLabel="Informar indisponibilidade"
          pendingLabel="Enviando…"
          destructive
          reason={{ required: false, label: "Observação" }}
          loading={declining}
          error={declineError}
          onConfirm={(note) => void declineAvailability(note)}
          onClose={() => {
            setDeclineOpen(false)
            setDeclineError("")
          }}
        />
      )}
    </div>
  )
}
