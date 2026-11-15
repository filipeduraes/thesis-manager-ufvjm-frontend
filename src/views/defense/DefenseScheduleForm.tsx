import { useEffect, useState } from "react"
import {
  ApiError,
  COMMITTEE_ROLE_LABELS,
  defenseApi,
  type ScheduleDefenseInput,
  type ThesisListItem,
} from "../../api/client"
import {
  Badge,
  Button,
  Card,
  ExternalMemberModal,
  Icon,
  InstitutionalMemberModal,
  Modal,
} from "../../components/common"
import type {
  DefenseModalityCode,
  ExternalMemberDraft,
  InstitutionalMemberDraft,
} from "../../types"

const SCHEDULABLE_PAGE_SIZE = 100
const MAX_DURATION_MINUTES = 720
const DEFENSE_TIME_ZONE = "America/Sao_Paulo"

type PendingMember =
  | { key: string; kind: "institutional"; draft: InstitutionalMemberDraft }
  | { key: string; kind: "external"; draft: ExternalMemberDraft }

interface MemberFailure {
  key: string
  name: string
  message: string
}

interface ScheduledOutcome {
  defenseId: string
  failures: MemberFailure[]
}

type ThesesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; theses: ThesisListItem[]; count: number }

function errorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof ApiError && reason.status === 429) {
    return "Muitas requisições em sequência. Aguarde alguns instantes e tente novamente."
  }
  return reason instanceof Error && reason.message ? reason.message : fallback
}

function initialsOf(name: string): string {
  const parts = name.split(" ").filter(Boolean).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
}

/** Returns the UTC offset of São Paulo, in minutes, at the given instant (e.g. -180). */
function saoPauloOffsetMinutes(instant: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: DEFENSE_TIME_ZONE, timeZoneName: "longOffset" })
  const offsetPart = formatter.formatToParts(instant).find((part) => part.type === "timeZoneName")
  const match = offsetPart?.value.match(/GMT([+-])(\d{2}):(\d{2})/)
  if (!match) return 0
  const sign = match[1] === "-" ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3]))
}

/**
 * Converts the values of `<input type="date">` and `<input type="time">`, read as
 * São Paulo wall-clock time, into an ISO 8601 UTC string.
 *
 * Returns `null` when either value is missing or malformed.
 */
function saoPauloInputsToIso(dateValue: string, timeValue: string): string | null {
  const dateParts = dateValue.split("-").map(Number)
  const timeParts = timeValue.split(":").map(Number)
  const [year, month, day] = dateParts
  const [hour, minute] = timeParts
  const values = [year, month, day, hour, minute]
  if (values.some((value) => value === undefined || Number.isNaN(value))) return null
  const wallClockAsUtc = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0)
  const offset = saoPauloOffsetMinutes(new Date(wallClockAsUtc))
  return new Date(wallClockAsUtc - offset * 60_000).toISOString()
}

interface DefenseScheduleFormProps {
  /** Opens the committee screen of the defense that was just created. */
  onOpenCommittee: (defenseId: string) => void
}

/**
 * Defense scheduling form backed by the real API.
 *
 * Theses come from `GET /api/v1/defenses/schedulable-theses`. Committee members are kept
 * in local state until the defense exists; after `POST /api/v1/theses/{id}/defenses`
 * succeeds, each member is sent in sequence and individual failures are reported.
 */
export default function DefenseScheduleForm({ onOpenCommittee }: DefenseScheduleFormProps) {
  const [thesesState, setThesesState] = useState<ThesesState>({ status: "loading" })
  const [thesesReloadKey, setThesesReloadKey] = useState(0)
  const [selectedThesis, setSelectedThesis] = useState<ThesisListItem | null>(null)
  const [selectionOpen, setSelectionOpen] = useState(false)
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [duration, setDuration] = useState("")
  const [modality, setModality] = useState<DefenseModalityCode | null>(null)
  const [location, setLocation] = useState("")
  const [notes, setNotes] = useState("")
  const [members, setMembers] = useState<PendingMember[]>([])
  const [memberModal, setMemberModal] = useState<"institutional" | "external" | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitStep, setSubmitStep] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [outcome, setOutcome] = useState<ScheduledOutcome | null>(null)

  useEffect(() => {
    let cancelled = false
    setThesesState({ status: "loading" })
    defenseApi
      .schedulableTheses({ pageSize: SCHEDULABLE_PAGE_SIZE })
      .then((response) => {
        if (!cancelled) setThesesState({ status: "ready", theses: response.results, count: response.count })
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setThesesState({
          status: "error",
          message: errorMessage(reason, "Não foi possível carregar as monografias aptas para banca."),
        })
      })
    return () => {
      cancelled = true
    }
  }, [thesesReloadKey])

  const reloadTheses = () => setThesesReloadKey((current) => current + 1)

  const durationMinutes = Number(duration)
  const durationValid = Number.isInteger(durationMinutes) && durationMinutes >= 1 && durationMinutes <= MAX_DURATION_MINUTES
  const scheduledDatetime = saoPauloInputsToIso(date, time)
  const formLocked = submitting || outcome !== null
  const canConfirm = Boolean(selectedThesis && scheduledDatetime && durationValid && modality) && !formLocked

  const addPendingMember = (member: PendingMember) => {
    if (members.some((current) => current.key === member.key)) {
      return Promise.reject(new Error("Este membro já foi incluído na comissão."))
    }
    setMembers((current) => [...current, member])
    return Promise.resolve()
  }

  const addInstitutionalDraft = (draft: InstitutionalMemberDraft) =>
    addPendingMember({ key: `institutional-${draft.userId}`, kind: "institutional", draft })

  const addExternalDraft = (draft: ExternalMemberDraft) =>
    addPendingMember({ key: `external-${draft.email}`, kind: "external", draft })

  const removePendingMember = (key: string) => {
    setMembers((current) => current.filter((member) => member.key !== key))
  }

  const resetForm = () => {
    setSelectedThesis(null)
    setDate("")
    setTime("")
    setDuration("")
    setModality(null)
    setLocation("")
    setNotes("")
    setMembers([])
    setSubmitError("")
    setOutcome(null)
  }

  const sendMember = (defenseId: string, member: PendingMember) => {
    if (member.kind === "institutional") {
      return defenseApi.addInstitutionalMember(defenseId, { role: member.draft.role, userId: member.draft.userId })
    }
    return defenseApi.addExternalMember(defenseId, {
      role: member.draft.role,
      name: member.draft.name,
      email: member.draft.email,
      institution: member.draft.institution || undefined,
    })
  }

  const confirmSchedule = async () => {
    if (!selectedThesis || !scheduledDatetime || !durationValid || !modality || formLocked) return
    setSubmitting(true)
    setSubmitError("")
    setSubmitStep("Agendando banca…")
    const body: ScheduleDefenseInput = {
      scheduledDatetime,
      durationMinutes,
      modality,
      location: location.trim(),
      notes: notes.trim(),
    }
    let defenseId: string
    try {
      const response = await defenseApi.schedule(selectedThesis.id, body)
      defenseId = response.defense.id
    } catch (reason) {
      setSubmitError(errorMessage(reason, "Não foi possível agendar a banca."))
      setSubmitting(false)
      setSubmitStep("")
      return
    }

    // Envio sequencial: o backend verifica conflito de horário por membro, e a ordem
    // previsível facilita identificar qual inclusão falhou.
    const failures: MemberFailure[] = []
    for (let index = 0; index < members.length; index += 1) {
      const member = members[index]
      if (!member) continue
      setSubmitStep(`Adicionando membros (${index + 1} de ${members.length})…`)
      try {
        await sendMember(defenseId, member)
      } catch (reason) {
        failures.push({
          key: member.key,
          name: member.draft.name,
          message: errorMessage(reason, "Não foi possível adicionar o membro."),
        })
      }
    }
    setSubmitting(false)
    setSubmitStep("")
    if (failures.length === 0) {
      onOpenCommittee(defenseId)
      return
    }
    setOutcome({ defenseId, failures })
  }

  const thesesCount = thesesState.status === "ready" ? thesesState.count : 0

  const thesisSummaryText = (() => {
    if (thesesState.status === "loading") return "Carregando monografias aptas…"
    if (thesesState.status === "error") return thesesState.message
    if (thesesCount === 0) return "Nenhuma monografia apta para agendamento no momento."
    return thesesCount === 1 ? "1 trabalho disponível" : `${thesesCount} trabalhos disponíveis`
  })()

  return (
    <>
      <Card className="thesis-summary">
        <div className="file-icon">
          <Icon name="file" />
        </div>
        <div aria-live="polite">
          {selectedThesis ? (
            <>
              <h3>{selectedThesis.title}</h3>
              <span>
                {selectedThesis.student?.name ?? "Autor não informado"} · {selectedThesis.course.name}
              </span>
            </>
          ) : (
            <>
              <h3>Selecione uma monografia aprovada</h3>
              <span role={thesesState.status === "error" ? "alert" : undefined}>{thesisSummaryText}</span>
            </>
          )}
        </div>
        {selectedThesis && <Badge tone="success">{selectedThesis.statusLabel}</Badge>}
        {thesesState.status === "error" ? (
          <Button variant="outline" onClick={reloadTheses}>
            Tentar novamente
          </Button>
        ) : (
          <Button
            variant={selectedThesis ? "ghost" : "outline"}
            disabled={formLocked || thesesState.status === "loading"}
            onClick={() => setSelectionOpen(true)}
          >
            {selectedThesis ? "Alterar" : "Selecionar"}
          </Button>
        )}
      </Card>

      <div className="schedule-layout">
        <div className="stack">
          <Card>
            <h2>Dados da defesa</h2>
            <fieldset className="plain-fieldset" disabled={formLocked}>
              <div className="three-col schedule-fields">
                <label className="field">
                  <span>Data</span>
                  <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </label>
                <label className="field">
                  <span>Horário</span>
                  <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
                </label>
                <label className="field">
                  <span>
                    Duração <small>(minutos)</small>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_DURATION_MINUTES}
                    step={1}
                    inputMode="numeric"
                    value={duration}
                    onChange={(event) => setDuration(event.target.value)}
                    aria-describedby="defense-duration-hint"
                  />
                  <small id="defense-duration-hint">Entre 1 e {MAX_DURATION_MINUTES} minutos.</small>
                </label>
              </div>
              <div className="field" role="radiogroup" aria-labelledby="defense-modality-label">
                <span id="defense-modality-label">Modalidade</span>
                <div className="segmented">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={modality === "IN_PERSON"}
                    className={modality === "IN_PERSON" ? "active" : ""}
                    onClick={() => setModality("IN_PERSON")}
                  >
                    Presencial
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={modality === "REMOTE"}
                    className={modality === "REMOTE" ? "active" : ""}
                    onClick={() => setModality("REMOTE")}
                  >
                    Remota
                  </button>
                </div>
              </div>
              <label className="field">
                <span>
                  {modality === "REMOTE" ? "Link da videoconferência" : "Local da defesa"} <small>(opcional)</small>
                </span>
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder={modality === "REMOTE" ? "https://meet.google.com/..." : "Sala / prédio"}
                />
              </label>
              <label className="field">
                <span>
                  Observações <small>(opcional)</small>
                </span>
                <textarea className="feedback-area" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
            </fieldset>
          </Card>

          <Card>
            <div className="section-head">
              <div>
                <h2>Comissão avaliadora</h2>
                <p>Os membros são enviados logo após o agendamento da banca.</p>
              </div>
              <Button variant="outline" icon="plus" disabled={formLocked} onClick={() => setMemberModal("external")}>
                Convidar externo
              </Button>
            </div>
            {members.length === 0 ? (
              <p>Nenhum membro incluído.</p>
            ) : (
              <div className="member-list">
                {members.map((member) => (
                  <div key={member.key}>
                    <div className="avatar">{initialsOf(member.draft.name)}</div>
                    <div>
                      <strong>{member.draft.name}</strong>
                      <span>
                        {COMMITTEE_ROLE_LABELS[member.draft.role] ?? member.draft.role} ·{" "}
                        {member.kind === "institutional" ? "Institucional" : "Externo"} · {member.draft.email}
                      </span>
                    </div>
                    <Badge tone="light">A enviar</Badge>
                    <Button variant="ghost" disabled={formLocked} onClick={() => removePendingMember(member.key)}>
                      Remover
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button variant="secondary" icon="plus" disabled={formLocked} onClick={() => setMemberModal("institutional")}>
              Adicionar membro interno
            </Button>
          </Card>
        </div>

        <aside className="conflict-panel">
          <Card className="sticky-panel">
            <p className="eyebrow">Resumo</p>
            <h2>Agendamento</h2>
            <div className="validation-list">
              <div className={selectedThesis ? "ok" : ""}>
                <Icon name={selectedThesis ? "check" : "clock"} />
                <span>
                  <strong>Monografia apta</strong>
                  <small>{selectedThesis ? selectedThesis.referenceCode : "Selecione uma monografia"}</small>
                </span>
              </div>
              <div className={scheduledDatetime && durationValid ? "ok" : ""}>
                <Icon name={scheduledDatetime && durationValid ? "check" : "clock"} />
                <span>
                  <strong>Data, horário e duração</strong>
                  <small>{scheduledDatetime && durationValid ? `${durationMinutes} minutos` : "Preencha os dados da defesa"}</small>
                </span>
              </div>
              <div className={modality ? "ok" : ""}>
                <Icon name={modality ? "check" : "clock"} />
                <span>
                  <strong>Modalidade</strong>
                  <small>{modality === "REMOTE" ? "Remota" : modality === "IN_PERSON" ? "Presencial" : "Escolha a modalidade"}</small>
                </span>
              </div>
              <div className={members.length > 0 ? "ok" : ""}>
                <Icon name={members.length > 0 ? "check" : "users"} />
                <span>
                  <strong>Comissão</strong>
                  <small>
                    {members.length === 1 ? "1 membro a enviar" : `${members.length} membros a enviar`}
                  </small>
                </span>
              </div>
            </div>
            <p className="immutable-note">
              Conflitos de horário são verificados pelo sistema ao incluir cada membro.
            </p>

            {submitStep && <p aria-live="polite">{submitStep}</p>}
            {submitError && (
              <div className="success-notice" role="alert">
                {submitError}
              </div>
            )}

            {outcome ? (
              <div role="alert">
                <div className="success-notice">
                  Banca agendada, mas {outcome.failures.length === 1 ? "1 membro não foi adicionado" : `${outcome.failures.length} membros não foram adicionados`}:
                </div>
                <ul>
                  {outcome.failures.map((failure) => (
                    <li key={failure.key}>
                      <strong>{failure.name}</strong>: {failure.message}
                    </li>
                  ))}
                </ul>
                <Button variant="success" onClick={() => onOpenCommittee(outcome.defenseId)}>
                  Abrir membros da banca
                </Button>
              </div>
            ) : (
              <>
                <Button disabled={!canConfirm} variant="success" onClick={() => void confirmSchedule()}>
                  {submitting ? "Agendando…" : "Confirmar agendamento"}
                </Button>
                <Button variant="ghost" disabled={submitting} onClick={resetForm}>
                  Limpar formulário
                </Button>
              </>
            )}
          </Card>
        </aside>
      </div>

      {selectionOpen && thesesState.status === "ready" && (
        <Modal className="admin-modal selection-modal" onClose={() => setSelectionOpen(false)} labelledBy="select-thesis-title">
          <div className="section-head">
            <div>
              <h2 id="select-thesis-title">Selecionar monografia</h2>
              {thesesState.count > thesesState.theses.length && (
                <p>
                  Exibindo {thesesState.theses.length} de {thesesState.count} monografias.
                </p>
              )}
            </div>
            <button className="icon-btn" onClick={() => setSelectionOpen(false)} aria-label="Fechar">
              <Icon name="close" />
            </button>
          </div>
          {thesesState.theses.length === 0 ? (
            <div className="empty-state compact">
              <p>Nenhuma monografia apta para agendamento. Apenas trabalhos aprovados pelo orientador e sem banca ativa aparecem aqui.</p>
            </div>
          ) : (
            <div className="selection-list">
              {thesesState.theses.map((thesis) => (
                <button
                  key={thesis.id}
                  className={selectedThesis?.id === thesis.id ? "selected" : ""}
                  onClick={() => {
                    setSelectedThesis(thesis)
                    setSelectionOpen(false)
                  }}
                >
                  <div>
                    <strong>{thesis.title}</strong>
                    <span>
                      {thesis.student?.name ?? "Autor não informado"} · {thesis.course.name} · {thesis.referenceCode}
                    </span>
                  </div>
                  <Badge tone="success">{thesis.statusLabel}</Badge>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {memberModal === "institutional" && (
        <InstitutionalMemberModal onClose={() => setMemberModal(null)} onSubmit={addInstitutionalDraft} />
      )}
      {memberModal === "external" && (
        <ExternalMemberModal onClose={() => setMemberModal(null)} onSubmit={addExternalDraft} />
      )}
    </>
  )
}
