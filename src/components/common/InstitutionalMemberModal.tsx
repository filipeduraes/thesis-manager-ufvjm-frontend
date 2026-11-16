import { useState } from "react"
import { COMMITTEE_ROLE_OPTIONS, type UserSuggestion } from "../../api/client"
import type { CommitteeRoleCode, InstitutionalMemberDraft } from "../../types"
import { normalizeInstitutionalEmail } from "../../hooks/useUserLookup"
import Button from "./Button"
import Icon from "./Icon"
import Modal from "./Modal"
import UserFoundCard from "./UserFoundCard"
import UserSuggestInput from "./UserSuggestInput"

interface InstitutionalMemberModalProps {
  onClose: () => void
  /**
   * Receives the chosen member. Rejecting with an `Error` keeps the modal open and shows
   * its message; resolving closes the modal.
   */
  onSubmit: (draft: InstitutionalMemberDraft) => Promise<void>
}

/**
 * Modal that finds an institutional user and picks their committee role.
 *
 * Typing filters live (up to three matches, keyboard or mouse); picking one
 * fills the e-mail. The backend search endpoint is restricted to managers
 * (admin/coordinator/advisor): other roles see the 403 message.
 */
export default function InstitutionalMemberModal({ onClose, onSubmit }: InstitutionalMemberModalProps) {
  const [email, setEmail] = useState("")
  const [selectedUser, setSelectedUser] = useState<UserSuggestion | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [role, setRole] = useState<CommitteeRoleCode>("MEMBER")
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const submitMember = async () => {
    if (!selectedUser) return
    setSubmitLoading(true)
    setSubmitError("")
    try {
      await onSubmit({
        role,
        userId: selectedUser.id,
        name: selectedUser.name,
        email: selectedUser.email,
        avatarUrl: selectedUser.avatarUrl,
      })
      onClose()
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : "Não foi possível adicionar o membro.")
      setSubmitLoading(false)
    }
  }

  const query = email.trim()
  const foundHint = selectedUser
    ? `Usuário encontrado: ${selectedUser.name}.`
    : searchError
      ? searchError
      : query.length >= 2 && !searching
        ? "Nenhum usuário correspondente."
        : ""

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

      <div className="field">
        <label htmlFor="institutional-member-user">
          <span>Usuário ou e-mail institucional</span>
        </label>
        <UserSuggestInput
          id="institutional-member-user"
          value={email}
          onChange={(next) => {
            setEmail(next)
            setSelectedUser(null)
            setSubmitError("")
          }}
          onBlur={() => {
            if (email.trim()) setEmail(normalizeInstitutionalEmail(email))
          }}
          onSelect={(user) => {
            setEmail(user.email)
            setSelectedUser(user)
            setSubmitError("")
          }}
          onSuggestionsChange={({ loading, error }) => {
            setSearching(loading)
            setSearchError(error)
          }}
          placeholder="nome.sobrenome, usuário ou nome.sobrenome@ufvjm.edu.br"
          autoComplete="email"
          autoFocus
        />
        {query.length >= 2 && (
          <span className="field-hint" aria-live="polite">
            {foundHint}
          </span>
        )}
      </div>

      {selectedUser && (
        <UserFoundCard name={selectedUser.name} email={selectedUser.email} avatarUrl={selectedUser.avatarUrl} />
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
        <Button disabled={!selectedUser || submitLoading} onClick={() => void submitMember()}>
          {submitLoading ? "Adicionando…" : "Adicionar membro"}
        </Button>
      </div>
    </Modal>
  )
}
