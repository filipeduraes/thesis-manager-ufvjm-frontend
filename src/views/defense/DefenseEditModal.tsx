import { useState } from "react"
import { ApiError, defenseApi, type DefenseData, type ScheduleWarning } from "../../api/client"
import { Button, Icon, Modal, ScheduleWarningDialog } from "../../components/common"
import type { DefenseScheduleDraft } from "../../types"
import DefenseScheduleFields from "./DefenseScheduleFields"
import { changedScheduleFields, defenseToDraft, isFutureStart, locationError } from "./defenseSchedule"

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
  const [pendingWarning, setPendingWarning] = useState<{ warnings: ScheduleWarning[]; retry: () => Promise<void> } | null>(null)
  const changes = changedScheduleFields(original, draft)
  const hasChanges = changes !== null && Object.keys(changes).length > 0
  const startInPast = changes?.scheduledDatetime !== undefined && !isFutureStart(changes.scheduledDatetime)
  // Como o backend, só valida o link quando modalidade ou local mudam: bancas antigas
  // com local fora do padrão continuam editáveis nos demais campos.
  const locationChanged = draft.modality !== original.modality || draft.location.trim() !== original.location.trim()
  const invalidLocation = locationChanged && locationError(draft) !== null
  const canSave = hasChanges && !startInPast && !invalidLocation && !saving

  const saveSchedule = async () => {
    if (!changes || !canSave) return
    setSaving(true)
    setSaveError("")
    try {
      await defenseApi.update(defense.id, changes)
      onSaved()
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "SCHEDULE_WARNING" && reason.warnings.length > 0) {
        setPendingWarning({
          warnings: reason.warnings,
          retry: async () => {
            await defenseApi.update(defense.id, { ...changes, acknowledgeScheduleWarning: true })
            onSaved()
          },
        })
        setSaving(false)
        return
      }
      setSaveError(saveErrorMessage(reason))
      setSaving(false)
    }
  }

  return (
    <>
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
        <div className="form-error" role="alert">
          {saveError}
        </div>
      )}

      <fieldset className="plain-fieldset" disabled={saving}>
        <DefenseScheduleFields
          idPrefix="edit-defense"
          value={draft}
          onChange={setDraft}
          validateLocation={locationChanged}
        />
      </fieldset>

      {startInPast && (
        <div className="form-error" role="alert">
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
    {pendingWarning && (
      <ScheduleWarningDialog
        warnings={pendingWarning.warnings}
        defenseStart={changes?.scheduledDatetime ?? defense.scheduledDatetime}
        defenseDurationMinutes={changes?.durationMinutes ?? defense.durationMinutes}
        onCancel={() => setPendingWarning(null)}
        onConfirm={() => {
          const retry = pendingWarning.retry
          setPendingWarning(null)
          setSaving(true)
          void retry().catch((reason: unknown) => {
            setSaveError(saveErrorMessage(reason))
            setSaving(false)
          })
        }}
      />
    )}
    </>
  )
}
