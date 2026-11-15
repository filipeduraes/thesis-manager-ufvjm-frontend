import { useState } from "react"
import { ApiError, adminApi, COMMITTEE_ROLE_OPTIONS } from "../../api/client"
import type { CommitteeRoleCode, InstitutionalMemberDraft } from "../../types"
import Badge from "./Badge"
import Button from "./Button"
import Icon from "./Icon"
import Modal from "./Modal"

interface FoundUser {
  id: string
  name: string
  email: string
}

function initialsOf(name: string): string {
  const parts = name.split(" ").filter(Boolean).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
}

interface InstitutionalMemberModalProps {
  onClose: () => void
  /**
   * Receives the chosen member. Rejecting with an `Error` keeps the modal open and shows
   * its message; resolving closes the modal.
   */
  onSubmit: (draft: InstitutionalMemberDraft) => Promise<void>
}

/**
 * Modal that finds an institutional user by e-mail and picks their committee role.
 *
 * The lookup uses `GET /api/v1/admin/users/lookup`, which the backend restricts to
 * administrators and coordinators on the institutional network (403 otherwise).
 */
export default function InstitutionalMemberModal({ onClose, onSubmit }: InstitutionalMemberModalProps) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<CommitteeRoleCode>("MEMBER")
  const [lookupLoading, setLookupLoading] = useState(false)
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null)
  const [lookupError, setLookupError] = useState("")
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const lookupUser = async () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) return
    setLookupLoading(true)
    setLookupError("")
    setFoundUser(null)
    try {
      const result = await adminApi.lookupUser(normalizedEmail)
      if (result.found && result.user) {
        setFoundUser(result.user)
      } else {
        setLookupError(result.message || "Usuário não encontrado.")
      }
    } catch (reason) {
      const forbidden = reason instanceof ApiError && reason.status === 403
      const fallback = reason instanceof Error ? reason.message : "Não foi possível buscar o usuário."
      setLookupError(
        forbidden ? "Busca de usuários disponível apenas para administradores na rede institucional." : fallback,
      )
    } finally {
      setLookupLoading(false)
    }
  }

  const submitMember = async () => {
    if (!foundUser) return
    setSubmitLoading(true)
    setSubmitError("")
    try {
      await onSubmit({ role, userId: foundUser.id, name: foundUser.name, email: foundUser.email })
      onClose()
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : "Não foi possível adicionar o membro.")
      setSubmitLoading(false)
    }
  }

  return (
    <Modal className="admin-modal invite-modal" onClose={onClose} labelledBy="institutional-member-title">
      <div className="section-head">
        <div>
          <h2 id="institutional-member-title">Adicionar membro institucional</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Fechar">
          <Icon name="close" />
        </button>
      </div>

      {submitError && (
        <div className="success-notice" role="alert">
          {submitError}
        </div>
      )}

      <label className="field">
        <span>E-mail institucional</span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setFoundUser(null)
              setLookupError("")
            }}
            placeholder="professor@ufvjm.edu.br"
          />
          <Button disabled={!email.trim() || lookupLoading} onClick={() => void lookupUser()}>
            {lookupLoading ? "Buscando…" : "Buscar"}
          </Button>
        </div>
      </label>

      {lookupError && (
        <div className="success-notice" role="alert">
          {lookupError}
        </div>
      )}

      {foundUser && (
        <div className="institutional-banner session-banner" aria-live="polite">
          <div className="avatar">{initialsOf(foundUser.name)}</div>
          <div>
            <strong>{foundUser.name}</strong>
            <span>{foundUser.email}</span>
          </div>
          <Badge tone="success">Encontrado</Badge>
        </div>
      )}

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
        <Button disabled={!foundUser || submitLoading} onClick={() => void submitMember()}>
          {submitLoading ? "Adicionando…" : "Adicionar membro"}
        </Button>
      </div>
    </Modal>
  )
}
