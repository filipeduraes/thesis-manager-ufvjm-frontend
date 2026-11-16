import { useState } from "react"
import { Button, Icon, Modal } from "../../components/common"

interface DefenseStatusConfirmModalProps {
  title: string
  /** What will happen after confirming, in plain language. */
  description: string
  confirmLabel: string
  pendingLabel: string
  /** Destructive actions use the danger icon and the solid danger button. */
  destructive?: boolean
  /** When set, shows a reason field; `required` blocks confirming while it is empty. */
  reason?: { required: boolean; label?: string }
  loading: boolean
  error: string
  onConfirm: (reason: string) => void
  onClose: () => void
}

/**
 * Confirmation modal for defense status actions, following the `confirmation-modal`
 * pattern of the thesis approval screen.
 */
export default function DefenseStatusConfirmModal({
  title,
  description,
  confirmLabel,
  pendingLabel,
  destructive = false,
  reason,
  loading,
  error,
  onConfirm,
  onClose,
}: DefenseStatusConfirmModalProps) {
  const [reasonText, setReasonText] = useState("")
  const missingReason = Boolean(reason?.required) && !reasonText.trim()
  const titleId = "defense-status-confirm-title"

  return (
    <Modal className="confirmation-modal" onClose={onClose} labelledBy={titleId}>
      <div className={`modal-icon${destructive ? " danger" : ""}`}>
        <Icon name={destructive ? "alert" : "clock"} />
      </div>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>

      {error && (
        <div className="form-error" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      {reason && (
        <label className="field">
          <span>
            {reason.label ?? "Motivo"} <small>{reason.required ? "(obrigatório)" : "(opcional)"}</small>
          </span>
          <textarea
            className="feedback-area"
            rows={3}
            value={reasonText}
            disabled={loading}
            onChange={(event) => setReasonText(event.target.value)}
          />
        </label>
      )}

      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Voltar
        </Button>
        {destructive ? (
          <button
            type="button"
            className="btn btn-danger-solid"
            disabled={loading || missingReason}
            onClick={() => onConfirm(reasonText.trim())}
          >
            {loading ? pendingLabel : confirmLabel}
          </button>
        ) : (
          <Button variant="success" disabled={loading || missingReason} onClick={() => onConfirm(reasonText.trim())}>
            {loading ? pendingLabel : confirmLabel}
          </Button>
        )}
      </div>
    </Modal>
  )
}
