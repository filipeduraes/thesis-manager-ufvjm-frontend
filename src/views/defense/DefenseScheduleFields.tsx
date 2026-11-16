import type { DefenseScheduleDraft } from "../../types"
import { DURATION_PRESETS, expectedEnd, locationError, MAX_DURATION_MINUTES } from "./defenseSchedule"

interface DefenseScheduleFieldsProps {
  value: DefenseScheduleDraft
  onChange: (next: DefenseScheduleDraft) => void
  /** Prefix for element ids, so two instances never share ids. */
  idPrefix: string
  /**
   * Whether to flag an invalid remote link. The edit modal turns it off while modality
   * and location are unchanged, as the backend does for older defenses.
   */
  validateLocation?: boolean
}

/**
 * Controlled scheduling fields shared by the scheduling form and the edit modal:
 * date, start time, duration (with shortcuts), expected end, modality, location, and notes.
 */
export default function DefenseScheduleFields({
  value,
  onChange,
  idPrefix,
  validateLocation = true,
}: DefenseScheduleFieldsProps) {
  const update = (patch: Partial<DefenseScheduleDraft>) => onChange({ ...value, ...patch })
  const end = expectedEnd(value.startTime, value.duration)
  const durationHintId = `${idPrefix}-duration-hint`
  const endId = `${idPrefix}-expected-end`
  const modalityLabelId = `${idPrefix}-modality-label`
  const isRemote = value.modality === "REMOTE"
  const locationHintId = `${idPrefix}-location-hint`
  const locationErrorId = `${idPrefix}-location-error`
  // Só aponta o erro depois que algo foi digitado; o campo vazio mostra a dica.
  const showLocationError = validateLocation && value.location.trim() !== "" && locationError(value) !== null

  return (
    <>
      <div className="three-col schedule-fields">
        <label className="field">
          <span>Data</span>
          <input type="date" value={value.date} onChange={(event) => update({ date: event.target.value })} />
        </label>
        <label className="field">
          <span>Horário de início</span>
          <input
            type="time"
            value={value.startTime}
            onChange={(event) => update({ startTime: event.target.value })}
          />
        </label>
        <div className="field">
          <label htmlFor={`${idPrefix}-duration`}>Duração da banca</label>
          <div className="duration-presets" role="group" aria-label="Atalhos de duração">
            {DURATION_PRESETS.map((preset) => {
              const active = value.duration === String(preset.minutes)
              return (
                <button
                  key={preset.minutes}
                  type="button"
                  className={active ? "active" : ""}
                  aria-pressed={active}
                  onClick={() => update({ duration: String(preset.minutes) })}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
          <input
            id={`${idPrefix}-duration`}
            type="number"
            min={1}
            max={MAX_DURATION_MINUTES}
            step={1}
            inputMode="numeric"
            value={value.duration}
            onChange={(event) => update({ duration: event.target.value })}
            aria-describedby={end ? `${durationHintId} ${endId}` : durationHintId}
          />
          <small id={durationHintId}>Em minutos, de 1 a {MAX_DURATION_MINUTES}.</small>
          {end && (
            <small id={endId} className="expected-end" aria-live="polite">
              Término previsto: {end.time}
              {end.nextDay ? " (dia seguinte)" : ""}
            </small>
          )}
        </div>
      </div>
      <div className="field" role="radiogroup" aria-labelledby={modalityLabelId}>
        <span id={modalityLabelId}>Modalidade</span>
        <div className="segmented">
          <button
            type="button"
            role="radio"
            aria-checked={value.modality === "IN_PERSON"}
            className={value.modality === "IN_PERSON" ? "active" : ""}
            onClick={() => update({ modality: "IN_PERSON" })}
          >
            Presencial
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={value.modality === "REMOTE"}
            className={value.modality === "REMOTE" ? "active" : ""}
            onClick={() => update({ modality: "REMOTE" })}
          >
            Remota
          </button>
        </div>
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-location`}>
          {isRemote ? "Link da defesa" : "Local da defesa"}
          {!isRemote && <small> (opcional)</small>}
        </label>
        <input
          id={`${idPrefix}-location`}
          type={isRemote ? "url" : "text"}
          inputMode={isRemote ? "url" : undefined}
          value={value.location}
          onChange={(event) => update({ location: event.target.value })}
          placeholder={isRemote ? "https://..." : "Sala / prédio"}
          aria-invalid={showLocationError || undefined}
          aria-describedby={isRemote ? (showLocationError ? locationErrorId : locationHintId) : undefined}
        />
        {isRemote && !showLocationError && (
          <small id={locationHintId}>Obrigatório para defesa remota: endereço http ou https da reunião.</small>
        )}
        {showLocationError && (
          <small id={locationErrorId} className="field-error" role="alert">
            {locationError(value)}
          </small>
        )}
      </div>
      <label className="field">
        <span>
          Observações <small>(opcional)</small>
        </span>
        <textarea
          className="feedback-area"
          rows={3}
          value={value.notes}
          onChange={(event) => update({ notes: event.target.value })}
        />
      </label>
    </>
  )
}
