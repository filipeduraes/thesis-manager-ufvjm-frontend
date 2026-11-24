import { useEffect, useState } from "react"
import {
  ApiError,
  COMMITTEE_ROLE_LABELS,
  defenseApi,
  type ScheduleConflict,
  type ScheduleWarning,
  type ThesisListItem,
} from "../../api/client"
import {
  Avatar,
  Badge,
  Button,
  Card,
  ExternalMemberModal,
  Icon,
  InstitutionalMemberModal,
  Modal,
  ScheduleWarningDialog,
} from "../../components/common"
import type {
  DefenseScheduleDraft,
  ExternalMemberDraft,
  InstitutionalMemberDraft,
} from "../../types"
import { thesisStatusTone } from "../../data/thesisStatus"
import DefenseScheduleFields from "./DefenseScheduleFields"
import {
  draftToScheduleInput,
  EMPTY_SCHEDULE_DRAFT,
  isFutureStart,
  locationError,
  scheduleSummary,
} from "./defenseSchedule"

const SCHEDULABLE_PAGE_SIZE = 100

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
  /** E-mails dos membros externos adicionados; o código de acesso vai só por e-mail. */
  invitedEmails: string[]
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

function modalityText(draft: DefenseScheduleDraft): string {
  if (draft.modality === "REMOTE") {
    return locationError(draft) ? "Remota · informe o link da defesa (https://...)" : "Remota"
  }
  if (draft.modality === "IN_PERSON") return "Presencial"
  return "Escolha a modalidade"
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
 * succeeds, each member is sent in sequence and individual failures are reported. External
 * members receive their access code by e-mail from the backend; this screen only lists
 * where the invitations go and never sees the code.
 */
export default function DefenseScheduleForm({ onOpenCommittee }: DefenseScheduleFormProps) {
  const [thesesState, setThesesState] = useState<ThesesState>({ status: "loading" })
  const [thesesReloadKey, setThesesReloadKey] = useState(0)
  const [selectedThesis, setSelectedThesis] = useState<ThesisListItem | null>(null)
  const [selectionOpen, setSelectionOpen] = useState(false)
  const [scheduleDraft, setScheduleDraft] = useState<DefenseScheduleDraft>(EMPTY_SCHEDULE_DRAFT)
  const [members, setMembers] = useState<PendingMember[]>([])
  const [memberModal, setMemberModal] = useState<"institutional" | "external" | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitStep, setSubmitStep] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [outcome, setOutcome] = useState<ScheduledOutcome | null>(null)
  const [pendingWarning, setPendingWarning] = useState<{ warnings: ScheduleWarning[]; retry: () => Promise<void> } | null>(null)
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([])

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

  const scheduleInput = draftToScheduleInput(scheduleDraft)
  const timeSummary = scheduleSummary(scheduleDraft)
  const formLocked = submitting || outcome !== null
  // O backend inicia automaticamente bancas com horário vencido; agendar no passado
  // deixaria a banca "Em andamento" antes de poder ser editada ou cancelada.
  const startInPast = scheduleInput !== null && !isFutureStart(scheduleInput.scheduledDatetime)
  const invalidLocation = locationError(scheduleDraft) !== null
  const modalityReady = Boolean(scheduleDraft.modality) && !invalidLocation
  const canConfirm = Boolean(selectedThesis && scheduleInput && members.length > 0 && !conflicts.some((item) => item.level === "RED")) && !startInPast && !invalidLocation && !formLocked

  const memberPayloads = () =>
    members.map((member) =>
      member.kind === "institutional"
        ? { role: member.draft.role, userId: member.draft.userId }
        : { role: member.draft.role, name: member.draft.name, email: member.draft.email, institution: member.draft.institution || "" },
    )

  const hasRedConflict = conflicts.some((item) => item.level === "RED")
  const hasYellowConflict = conflicts.some((item) => item.level === "YELLOW")
  const checkKey = JSON.stringify({ schedule: scheduleInput, members })
  useEffect(() => {
    if (!scheduleInput || members.length === 0) {
      setConflicts([])
      return
    }
    let cancelled = false
    defenseApi
      .checkSchedule({ ...scheduleInput, members: memberPayloads() })
      .then((response) => {
        if (!cancelled) setConflicts(response.conflicts)
      })
      .catch(() => {
        if (!cancelled) setConflicts([])
      })
    return () => {
      cancelled = true
    }
  }, [checkKey])

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
    setScheduleDraft(EMPTY_SCHEDULE_DRAFT)
    setMembers([])
    setSubmitError("")
    setOutcome(null)
  }

  /** Banca e comissão são enviadas juntas: uma transação só, sem membro parcial. */
  const confirmSchedule = async () => {
    if (!selectedThesis || !scheduleInput || members.length === 0 || formLocked) return
    setSubmitting(true)
    setSubmitError("")
    setSubmitStep("Agendando banca e comissão…")

    const finish = (defenseId: string) => {
      const invitedEmails = members.flatMap((member) => (member.kind === "external" ? [member.draft.email] : []))
      setSubmitting(false)
      setSubmitStep("")
      if (invitedEmails.length === 0) {
        onOpenCommittee(defenseId)
        return
      }
      setOutcome({ defenseId, failures: [], invitedEmails })
    }

    const submit = async (acknowledge: boolean) => {
      const body = { ...scheduleInput, members: memberPayloads(), acknowledgeScheduleWarning: acknowledge }
      const response = await defenseApi.schedule(selectedThesis.id, body)
      finish(response.defense.id)
    }

    try {
      await submit(false)
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "SCHEDULE_WARNING" && reason.warnings.length > 0) {
        setPendingWarning({ warnings: reason.warnings, retry: () => submit(true) })
        setSubmitting(false)
        setSubmitStep("")
        return
      }
      setSubmitError(errorMessage(reason, "Não foi possível agendar a banca."))
      setSubmitting(false)
      setSubmitStep("")
    }
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
        {selectedThesis && <Badge tone={thesisStatusTone(selectedThesis.status)}>{selectedThesis.statusLabel}</Badge>}
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
              <DefenseScheduleFields idPrefix="schedule" value={scheduleDraft} onChange={setScheduleDraft} />
            </fieldset>
          </Card>

          <Card>
            <div className="section-head">
              <div>
                <h2>Comissão avaliadora</h2>
              </div>
              <Button variant="outline" icon="plus" disabled={formLocked} onClick={() => setMemberModal("external")}>
                Convidar externo
              </Button>
            </div>
            {members.length === 0 ? (
              <p>
                Nenhum membro incluído. Adicione ao menos um avaliador antes de confirmar o agendamento.
              </p>
            ) : (
              <div className="member-list">
                {members.map((member) => (
                  <div key={member.key}>
                    <Avatar
                      name={member.draft.name}
                      imageUrl={member.kind === "institutional" ? member.draft.avatarUrl : null}
                    />
                    <div>
                      <strong>{member.draft.name}</strong>
                      <span>
                        {COMMITTEE_ROLE_LABELS[member.draft.role] ?? member.draft.role} ·{" "}
                        {member.kind === "institutional" ? "Institucional" : "Externo"} · {member.draft.email}
                      </span>
                    </div>
                    <Badge tone="neutral">A enviar</Badge>
                    <Button variant="danger" disabled={formLocked} onClick={() => removePendingMember(member.key)}>
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
              <div className={timeSummary && !startInPast ? "ok" : ""}>
                <Icon name={timeSummary && !startInPast ? "check" : "clock"} />
                <span>
                  <strong>Data, horário e duração</strong>
                  <small>
                    {startInPast ? "O horário de início já passou" : timeSummary ?? "Preencha os dados da defesa"}
                  </small>
                </span>
              </div>
              <div className={modalityReady ? "ok" : ""}>
                <Icon name={modalityReady ? "check" : "clock"} />
                <span>
                  <strong>Modalidade</strong>
                  <small>{modalityText(scheduleDraft)}</small>
                </span>
              </div>
              <div className={hasRedConflict ? "danger" : hasYellowConflict ? "warning" : members.length > 0 ? "ok" : ""}>
                <Icon name={hasRedConflict ? "close" : hasYellowConflict ? "warning" : members.length > 0 ? "check" : "users"} />
                <span>
                  <strong>Comissão</strong>
                  <small>
                    {members.length === 1 ? "1 membro" : `${members.length} membros`}
                  </small>
                </span>
              </div>
            </div>
            {(hasRedConflict || hasYellowConflict) && (
              <ul className="schedule-conflicts" aria-live="polite">
                {conflicts.map((conflict) => (
                  <li key={`${conflict.memberName}-${conflict.level}`} className={conflict.level === "RED" ? "danger" : "warning"}>
                    <Icon name={conflict.level === "RED" ? "close" : "warning"} size={16} />
                    <span>{conflict.message}</span>
                  </li>
                ))}
              </ul>
            )}

            {submitStep && <p aria-live="polite">{submitStep}</p>}
            {submitError && (
              <div className="form-error" role="alert">
                {submitError}
              </div>
            )}

            {outcome && outcome.invitedEmails.length > 0 && (
              <div className="success-notice" role="status">
                Banca agendada. O código de acesso de cada membro externo é enviado por e-mail:
                <ul>
                  {outcome.invitedEmails.map((email) => (
                    <li key={email}>Convite enviado para {email}</li>
                  ))}
                </ul>
              </div>
            )}

            {outcome && outcome.failures.length === 0 ? (
              <Button variant="success" onClick={() => onOpenCommittee(outcome.defenseId)}>
                Abrir membros da banca
              </Button>
            ) : outcome ? (
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
                  <Badge tone={thesisStatusTone(thesis.status)}>{thesis.statusLabel}</Badge>
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

      {pendingWarning && scheduleInput && (
        <ScheduleWarningDialog
          warnings={pendingWarning.warnings}
          defenseStart={scheduleInput.scheduledDatetime}
          defenseDurationMinutes={scheduleInput.durationMinutes}
          onCancel={() => setPendingWarning(null)}
          onConfirm={() => {
            const retry = pendingWarning.retry
            setPendingWarning(null)
            void retry()
          }}
        />
      )}
    </>
  )
}
