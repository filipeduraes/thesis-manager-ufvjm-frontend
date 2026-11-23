import { useRef, useState } from "react"
import { repositoryApi, type Thesis } from "../../api/client"
import { Button, Icon, Modal } from "../../components/common"
import { REPOSITORY_MAX_REASON_LENGTH, repositoryErrorMessage } from "./repositoryForm"

interface UnpublishThesisModalProps {
  thesis: Thesis
  onClose: () => void
  onUnpublished: (thesis: Thesis) => void
}

/**
 * Removes a thesis from the public repository (`POST /theses/<id>/unpublish`).
 * The reason is mandatory and the thesis becomes `ARCHIVED`; there is no republication.
 */
export default function UnpublishThesisModal({ thesis, onClose, onUnpublished }: UnpublishThesisModalProps) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)
  const trimmedReason = reason.trim()

  const unpublish = async () => {
    if (sendingRef.current) return
    if (!trimmedReason) {
      setError("Informe o motivo da despublicação.")
      return
    }
    sendingRef.current = true
    setSending(true)
    setError("")
    try {
      const response = await repositoryApi.unpublish(thesis.id, trimmedReason)
      onUnpublished(response.thesis)
    } catch (reason) {
      setError(repositoryErrorMessage(reason, "Não foi possível despublicar a monografia."))
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  return (
    <Modal className="admin-modal confirmation-modal" onClose={sending ? undefined : onClose} labelledBy="unpublish-title">
      <div className="modal-icon danger">
        <Icon name="alert" />
      </div>
      <h2 id="unpublish-title">Despublicar monografia?</h2>
      <p>
        “{thesis.title}” sairá do repositório público imediatamente e ficará arquivada. Arquivos e histórico são
        mantidos, mas a monografia não poderá ser republicada nem excluída.
      </p>
      <div className="field">
        <label htmlFor="unpublish-reason">
          <span>Motivo da despublicação</span>
        </label>
        <textarea
          id="unpublish-reason"
          className="feedback-area small"
          value={reason}
          maxLength={REPOSITORY_MAX_REASON_LENGTH}
          required
          aria-required="true"
          disabled={sending}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      {error && (
        <div className="form-error" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose} disabled={sending}>
          Cancelar
        </Button>
        <button
          type="button"
          className="btn btn-danger-solid"
          disabled={sending || !trimmedReason}
          onClick={() => void unpublish()}
        >
          {sending ? "Despublicando…" : "Confirmar despublicação"}
        </button>
      </div>
    </Modal>
  )
}
