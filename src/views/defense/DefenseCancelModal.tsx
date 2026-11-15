import { useState } from "react"
import { defenseApi } from "../../api/client"
import { Button, Icon, Modal } from "../../components/common"
import { statusActionErrorMessage } from "./defenseErrors"

interface DefenseCancelModalProps {
  defenseId: string
  onClose: () => void
  /** Called after `POST /api/v1/defenses/{id}/cancel` succeeds; the parent reloads the defense. */
  onCancelled: () => void
}

/**
 * Confirmation modal for cancelling a scheduled defense, with an optional reason that the
 * backend records in the thesis status history.
 */
export default function DefenseCancelModal({ defenseId, onClose, onCancelled }: DefenseCancelModalProps) {
  const [reason, setReason] = useState("")
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState("")

  const confirmCancel = async () => {
    if (cancelling) return
    setCancelling(true)
    setCancelError("")
    try {
      await defenseApi.cancel(defenseId, reason.trim())
      onCancelled()
    } catch (failure) {
      setCancelError(statusActionErrorMessage(failure, "Não foi possível cancelar a banca."))
      setCancelling(false)
    }
  }

  return (
    <Modal className="admin-modal invite-modal" onClose={onClose} labelledBy="cancel-defense-title">
      <div className="section-head">
        <div>
          <h2 id="cancel-defense-title">Cancelar banca</h2>
          <p>A banca passa para Cancelada e a monografia volta ao status anterior ao agendamento. Somente um administrador pode reverter o cancelamento.</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Fechar">
          <Icon name="close" />
        </button>
      </div>

      {cancelError && (
        <div className="success-notice" role="alert">
          {cancelError}
        </div>
      )}

      <label className="field">
        <span>
          Motivo <small>(opcional)</small>
        </span>
        <textarea
          className="feedback-area"
          rows={3}
          value={reason}
          disabled={cancelling}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Descreva o motivo do cancelamento"
        />
      </label>

      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Voltar
        </Button>
        <Button variant="danger" disabled={cancelling} onClick={() => void confirmCancel()}>
          {cancelling ? "Cancelando…" : "Confirmar cancelamento"}
        </Button>
      </div>
    </Modal>
  )
}
