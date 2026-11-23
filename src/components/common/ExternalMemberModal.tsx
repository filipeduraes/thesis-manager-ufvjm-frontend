import { useState } from "react"
import { COMMITTEE_ROLE_OPTIONS } from "../../api/client"
import type { CommitteeRoleCode, ExternalMemberDraft } from "../../types"
import Button from "./Button"
import Icon from "./Icon"
import Modal from "./Modal"

interface ExternalMemberModalProps {
  onClose: () => void
  /**
   * Receives the external member data. Rejecting with an `Error` keeps the modal open and
   * shows its message; resolving closes the modal.
   */
  onSubmit: (draft: ExternalMemberDraft) => Promise<void>
}

/**
 * Modal that collects an external committee member (name, e-mail, institution, role).
 *
 * The invitation itself is created by the backend when the member is added to a defense
 * (`POST /api/v1/defenses/{id}/members/external`).
 */
export default function ExternalMemberModal({ onClose, onSubmit }: ExternalMemberModalProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [institution, setInstitution] = useState("")
  const [role, setRole] = useState<CommitteeRoleCode>("MEMBER")
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const canSubmit = Boolean(name.trim() && email.trim()) && !submitLoading

  const submitMember = async () => {
    if (!name.trim() || !email.trim()) return
    setSubmitLoading(true)
    setSubmitError("")
    try {
      await onSubmit({
        role,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        institution: institution.trim(),
      })
      onClose()
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : "Não foi possível adicionar o membro.")
      setSubmitLoading(false)
    }
  }

  return (
    <Modal className="admin-modal invite-modal" onClose={onClose} labelledBy="external-member-title">
      <div className="section-head">
        <div>
          <h2 id="external-member-title">Adicionar membro externo</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Fechar">
          <Icon name="close" />
        </button>
      </div>

      {submitError && (
        <div className="form-error" role="alert">
          {submitError}
        </div>
      )}

      <label className="field">
        <span>Nome completo</span>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do avaliador" />
      </label>

      <label className="field">
        <span>E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="avaliador@email.com"
        />
      </label>

      <label className="field">
        <span>
          Instituição <small>(opcional)</small>
        </span>
        <input
          value={institution}
          onChange={(event) => setInstitution(event.target.value)}
          placeholder="Nome da instituição"
        />
      </label>

      <label className="field">
        <span>Papel na banca</span>
        <select value={role} onChange={(event) => setRole(event.target.value as CommitteeRoleCode)}>
          {COMMITTEE_ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={!canSubmit} onClick={() => void submitMember()}>
          {submitLoading ? "Adicionando…" : "Adicionar membro externo"}
        </Button>
      </div>
    </Modal>
  )
}
