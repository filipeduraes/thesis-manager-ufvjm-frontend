import { useMemo, useRef, useState } from "react"
import type { FormEvent } from "react"
import { repositoryApi, type Thesis } from "../../api/client"
import { Button, Field, Icon, Modal } from "../../components/common"
import { useRepositoryCourses } from "../../hooks/useRepositoryCourses"
import RepositoryMetadataFields from "./RepositoryMetadataFields"
import {
  changedMetadata,
  draftFromThesis,
  draftToMetadata,
  repositoryErrorMessage,
  validateRepositoryDraft,
  type RepositoryMetadataDraft,
} from "./repositoryForm"

interface PublishedMetadataModalProps {
  thesis: Thesis
  onClose: () => void
  onSaved: (thesis: Thesis) => void
}

/**
 * Edits the metadata of a published thesis (`PATCH /theses/<id>/published`),
 * sending only the changed fields plus an optional reason.
 */
export default function PublishedMetadataModal({ thesis, onClose, onSaved }: PublishedMetadataModalProps) {
  const courses = useRepositoryCourses()
  const initialDraft = useMemo(() => draftFromThesis(thesis), [thesis])
  const [draft, setDraft] = useState<RepositoryMetadataDraft>(initialDraft)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (savingRef.current) return
    const problem = validateRepositoryDraft(draft)
    if (problem) {
      setError(problem)
      return
    }
    const changes = changedMetadata(draftToMetadata(initialDraft), draftToMetadata(draft))
    if (Object.keys(changes).length === 0) {
      setError("Nenhuma alteração foi informada.")
      return
    }
    savingRef.current = true
    setSaving(true)
    setError("")
    try {
      const trimmedReason = reason.trim()
      const body = trimmedReason ? { ...changes, reason: trimmedReason } : changes
      const response = await repositoryApi.updatePublished(thesis.id, body)
      onSaved(response.thesis)
    } catch (reason) {
      setError(repositoryErrorMessage(reason, "Não foi possível salvar as alterações."))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <Modal className="admin-modal" onClose={saving ? undefined : onClose} labelledBy="published-metadata-title">
      <form className="repository-form" onSubmit={(event) => void save(event)} noValidate>
        <div className="section-head">
          <h2 id="published-metadata-title">Editar metadados publicados</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar" disabled={saving}>
            <Icon name="close" />
          </button>
        </div>
        <RepositoryMetadataFields idPrefix="published" draft={draft} onChange={setDraft} courses={courses} disabled={saving} />
        <Field
          label="Motivo da alteração (opcional)"
          value={reason}
          onChange={setReason}
          maxLength={1000}
          disabled={saving}
          hint="Fica registrado no histórico da monografia e na auditoria."
        />
        {error && (
          <div className="form-error" role="alert">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}
        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
