import { useState } from "react"
import { ApiError, defenseApi, type DefenseData } from "../../api/client"
import { Button, Icon, Modal } from "../../components/common"
import type { DefenseScheduleDraft } from "../../types"
import DefenseScheduleFields from "./DefenseScheduleFields"
import { changedScheduleFields, defenseToDraft, isFutureStart } from "./defenseSchedule"

function saveErrorMessage(reason: unknown): string {
  if (reason instanceof ApiError && reason.status === 403) {
    return "Você não tem permissão para alterar esta banca."
  }
  if (reason instanceof ApiError && reason.status === 429) {
    return "Muitas requisições em sequência. Aguarde alguns instantes e tente novamente."
  }
  return reason instanceof Error && reason.message ? reason.message : "Não foi possível salvar o agendamento."
}

interface DefenseEditModalProps {
  defense: DefenseData
  onClose: () => void
  /** Called after `PATCH /api/v1/defenses/{id}` succeeds; the parent reloads the defense. */
  onSaved: () => void
}

/**
 * Modal that edits date, start time, duration, modality, location, and notes of a
 * scheduled defense through `PATCH /api/v1/defenses/{id}`.
 */
export default function DefenseEditModal({ defense, onClose, onSaved }: DefenseEditModalProps) {
  const [original] = useState<DefenseScheduleDraft>(() => defenseToDraft(defense))
  const [draft, setDraft] = useState<DefenseScheduleDraft>(original)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const changes = changedScheduleFields(original, draft)
  const hasChanges = changes !== null && Object.keys(changes).length > 0
  const startInPast = changes?.scheduledDatetime !== undefined && !isFutureStart(changes.scheduledDatetime)
  const canSave = hasChanges && !startInPast && !saving

  const saveSchedule = async () => {
    if (!changes || !canSave) return
    setSaving(true)
    setSaveError("")
    try {
      await defenseApi.update(defense.id, changes)
      onSaved()
    } catch (reason) {
      setSaveError(saveErrorMessage(reason))
      setSaving(false)
    }
  }

  return (
    <Modal className="admin-modal invite-modal" onClose={onClose} labelledBy="edit-defense-title">
      <div className="section-head">
        <div>
          <h2 id="edit-defense-title">Editar agendamento</h2>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Fechar">
          <Icon name="close" />
        </button>
      </div>

      {saveError && (
        <div className="success-notice" role="alert">
          {saveError}
        </div>
      )}

      <fieldset className="plain-fieldset" disabled={saving}>
        <DefenseScheduleFields idPrefix="edit-defense" value={draft} onChange={setDraft} />
      </fieldset>

      {startInPast && (
        <div className="success-notice" role="alert">
          O novo horário de início já passou. Escolha uma data e um horário futuros.
        </div>
      )}

      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button disabled={!canSave} onClick={() => void saveSchedule()}>
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </Modal>
  )
}
