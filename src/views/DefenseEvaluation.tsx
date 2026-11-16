import { useCallback, useEffect, useRef, useState } from "react"
import {
  ApiError,
  COMMITTEE_ROLE_LABELS,
  DEFENSE_RESULT_LABELS,
  defenseApi,
  NO_DEFENSE_PERMISSIONS,
  type DefenseCommitteeMember,
  type DefenseData,
  type DefenseMemberEvaluationData,
} from "../api/client"
import { Badge, Button, Card, Icon, PageTitle } from "../components/common"
import { defenseStatusTone } from "../data/defenseStatus"
import DefenseAvailabilityResponse from "./defense/DefenseAvailabilityResponse"
import { formatDefenseTimeRange, formatDuration } from "./defense/defenseSchedule"

type DecisionCode = "APPROVED" | "APPROVED_WITH_REMARKS" | "REJECTED"

interface DefenseEvaluationProps {
  /** UUID da defesa a ser avaliada. */
  defenseId: string
  /** E-mail do usuário autenticado; usado para localizar o membro correspondente na banca. */
  userEmail: string
  /**
   * Id do membro, quando a sessão o informa (externalInvitation.assignments); tem
   * prioridade sobre a busca pelo e-mail.
   */
  memberId?: string
  /** Sem `goBack`, os botões Voltar/Cancelar não aparecem (tela externa com uma só banca). */
  goBack?: () => void
  onSubmitted?: () => void
  /**
   * `external`: tela do avaliador externo, que mostra também os dados completos da banca
   * e a confirmação de disponibilidade enquanto ela está agendada.
   */
  variant?: "institutional" | "external"
}

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
})

const DECISION_OPTIONS: Array<{
  value: DecisionCode
  label: string
  description: string
}> = [
  { value: "APPROVED", label: "Aprovada", description: "Apta para publicação" },
  {
    value: "APPROVED_WITH_REMARKS",
    label: "Aprovada com ressalvas",
    description: "Requer ajustes antes da publicação",
  },
  {
    value: "REJECTED",
    label: "Reprovada",
    description: "Não atende aos critérios da banca",
  },
]

function evaluationErrorMessage(reason: unknown): string {
  if (reason instanceof ApiError && reason.status === 403) {
    return "Você não tem permissão para avaliar esta banca."
  }
  return reason instanceof Error
    ? reason.message
    : "Não foi possível registrar a avaliação."
}

/**
 * Formulário de avaliação individual de um membro da banca.
 *
 * Carrega a defesa, localiza o membro pelo e-mail do usuário autenticado e
 * exibe o formulário de decisão + nota + observações. O formulário fica desabilitado
 * quando a banca não está em andamento (status !== IN_PROGRESS).
 */
export default function DefenseEvaluation({
  defenseId,
  userEmail,
  memberId,
  goBack,
  onSubmitted,
  variant = "institutional",
}: DefenseEvaluationProps) {
  const [defense, setDefense] = useState<DefenseData | null>(null)
  const [myMember, setMyMember] = useState<DefenseCommitteeMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [decision, setDecision] = useState<DecisionCode>("APPROVED")
  const [score, setScore] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [evaluation, setEvaluation] = useState<DefenseMemberEvaluationData | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  // Avaliação salva, mas o encerramento automático falhou (a banca segue em andamento).
  const [autoCloseError, setAutoCloseError] = useState("")
  const mountedRef = useRef(false)
  const firstLoadRef = useRef(true)

  const loadDefense = useCallback(() => {
    if (firstLoadRef.current) {
      setLoading(true)
      firstLoadRef.current = false
    } else {
      setRefreshing(true)
    }
    setLoadError("")
    defenseApi
      .get(defenseId)
      .then(({ defense: data }) => {
        if (!mountedRef.current) return
        setDefense(data)
        const member = memberId
          ? data.members.find((m) => m.id === memberId)
          : data.members.find((m) => m.email.toLowerCase() === userEmail.toLowerCase())
        if (member) {
          setMyMember(member)
          if (member.evaluation) {
            const ev = member.evaluation
            setEvaluation(ev)
            setDecision((ev.decision as DecisionCode) ?? "APPROVED")
            setScore(ev.score ?? "")
            setNotes(ev.notes ?? "")
          }
        }
      })
      .catch((reason: unknown) => {
        if (!mountedRef.current) return
        const msg =
          reason instanceof ApiError && reason.status === 403
            ? "Você não tem permissão para acessar esta banca."
            : reason instanceof Error
              ? reason.message
              : "Não foi possível carregar a defesa."
        setLoadError(msg)
      })
      .finally(() => {
        if (mountedRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      })
  }, [defenseId, userEmail, memberId])

  useEffect(() => {
    mountedRef.current = true
    loadDefense()
    return () => {
      mountedRef.current = false
    }
  }, [loadDefense])

  const isCompleted = defense?.status === "COMPLETED"
  // result/resultLabel vêm do próprio detalhe para qualquer usuário que vê a banca.
  const resultLabel = defense?.resultLabel ?? null

  const submitEvaluation = async () => {
    if (!myMember) return
    setSubmitting(true)
    setSubmitError("")
    try {
      const body: { decision: string; score?: string | null; notes?: string } = {
        decision,
        notes: notes.trim() || undefined,
      }
      if (score.trim()) {
        const numeric = parseFloat(score)
        if (isNaN(numeric) || numeric < 0 || numeric > 10) {
          setSubmitError("A nota deve ser um número entre 0,00 e 10,00.")
          setSubmitting(false)
          return
        }
        body.score = numeric.toFixed(2)
      }
      const response = await defenseApi.submitEvaluation(
        defenseId,
        myMember.id,
        body,
      )
      const ev = response.evaluation
      setEvaluation(ev)
      setDecision((ev.decision as DecisionCode) ?? "APPROVED")
      setScore(ev.score ?? "")
      setNotes(ev.notes ?? "")
      setAutoCloseError(response.autoCloseError ?? "")
      onSubmitted?.()
      // A última avaliação pode ter encerrado a banca: recarrega status e resultado.
      loadDefense()
    } catch (reason) {
      setSubmitError(evaluationErrorMessage(reason))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="page-content">
        <PageTitle eyebrow="Avaliação de banca" title="Carregando…" />
        <Card>
          <p aria-live="polite">Carregando dados da defesa…</p>
        </Card>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page-content">
        <PageTitle eyebrow="Avaliação de banca" title="Avaliação" />
        <Card>
          <div className="success-notice" role="alert">
            {loadError}
          </div>
          {goBack && (
            <div className="form-actions">
              <Button variant="ghost" onClick={goBack}>
                Voltar
              </Button>
            </div>
          )}
        </Card>
      </div>
    )
  }

  if (!defense) return null

  if (!myMember) {
    return (
      <div className="page-content">
        <PageTitle eyebrow="Avaliação de banca" title="Avaliação" />
        <Card>
          <p>Você não está registrado como membro desta banca.</p>
          {goBack && (
            <div className="form-actions">
              <Button variant="ghost" onClick={goBack}>
                Voltar
              </Button>
            </div>
          )}
        </Card>
      </div>
    )
  }

  const isInProgress = defense.status === "IN_PROGRESS"
  // Quem pode encerrar vem do backend (canClose), não do perfil; sessões externas recebem tudo falso.
  const canClose = (defense.viewerPermissions ?? NO_DEFENSE_PERMISSIONS).canClose
  const isAlternate = myMember.role === "ALTERNATE"
  const hasSubmitted = evaluation !== null
  const statusTone = defenseStatusTone(defense.status)

  const scheduledDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(defense.scheduledDatetime))

  return (
    <div className="page-content">
      <PageTitle eyebrow="Avaliação de banca" title="Minha avaliação" />

      <Card className="thesis-summary defense-summary">
        <div className="file-icon">
          <Icon name="calendar" />
        </div>
        <div>
          <h3>
            {scheduledDate} · {defense.modalityLabel}
          </h3>
          {defense.location && <span>{defense.location}</span>}
        </div>
        <div className="defense-actions">
          <Badge tone={statusTone}>{defense.statusLabel}</Badge>
          <span>{COMMITTEE_ROLE_LABELS[myMember.role] ?? myMember.roleLabel}</span>
          <Button variant="outline" disabled={refreshing} onClick={loadDefense}>
            {refreshing ? "Atualizando…" : "Atualizar"}
          </Button>
        </div>
      </Card>

      {variant === "external" && (
        <Card>
          <h2>Dados da banca</h2>
          <dl className="meta-list defense-details">
            <div>
              <dt>Data</dt>
              <dd>{LONG_DATE_FORMATTER.format(new Date(defense.scheduledDatetime))}</dd>
            </div>
            <div>
              <dt>Horário</dt>
              <dd>{formatDefenseTimeRange(defense.scheduledDatetime, defense.durationMinutes)}</dd>
            </div>
            <div>
              <dt>Duração</dt>
              <dd>{formatDuration(defense.durationMinutes)}</dd>
            </div>
            <div>
              <dt>Modalidade</dt>
              <dd>{defense.modalityLabel}</dd>
            </div>
            <div>
              <dt>{defense.modality === "REMOTE" ? "Link" : "Local"}</dt>
              <dd>{defense.location || "Não informado"}</dd>
            </div>
            <div>
              <dt>Seu papel</dt>
              <dd>{COMMITTEE_ROLE_LABELS[myMember.role] ?? myMember.roleLabel}</dd>
            </div>
          </dl>
        </Card>
      )}

      {variant === "external" && defense.status === "SCHEDULED" && (
        <Card>
          <h2>Sua disponibilidade</h2>
          <p>Confirme se você pode participar da banca no horário agendado.</p>
          <DefenseAvailabilityResponse defenseId={defense.id} member={myMember} onResponded={loadDefense} />
        </Card>
      )}

      {isAlternate && (
        <Card>
          <div className="conflict-message" role="status">
            <Icon name="alert" />
            <div>
              <strong>Suplentes não submetem avaliação</strong>
              <span>
                Sua participação como suplente não inclui a avaliação individual.
              </span>
            </div>
          </div>
          {goBack && (
            <div className="form-actions">
              <Button variant="ghost" onClick={goBack}>
                Voltar
              </Button>
            </div>
          )}
        </Card>
      )}

      {isCompleted && (
        <Card>
          <div className="conflict-message resolved" role="status" aria-live="polite">
            <Icon name="check" />
            <div>
              <strong>{resultLabel ? `Banca encerrada. Resultado: ${resultLabel}` : "Banca encerrada."}</strong>
              <span>
                {resultLabel
                  ? "As avaliações não podem mais ser alteradas."
                  : "As avaliações não podem mais ser alteradas. O resultado final é divulgado pela coordenação do curso."}
              </span>
            </div>
          </div>
        </Card>
      )}

      {isInProgress && autoCloseError && (
        <Card>
          <div className="conflict-message auto-close-warning" role="status" aria-live="polite">
            <Icon name="alert" />
            <div>
              <strong>Avaliação salva. A banca não pôde ser encerrada automaticamente: {autoCloseError}</strong>
              <span>
                {canClose
                  ? "Você pode encerrar a banca manualmente em Gerenciar banca."
                  : "Quem gerencia a banca pode encerrá-la manualmente."}
              </span>
            </div>
          </div>
        </Card>
      )}

      {!isAlternate && !isInProgress && !isCompleted && (
        <Card>
          <div className="conflict-message" role="status" aria-live="polite">
            <Icon name="clock" />
            <div>
              <strong>
                Avaliação disponível quando a banca estiver em andamento
              </strong>
              <span>Status atual: {defense.statusLabel}</span>
            </div>
          </div>
        </Card>
      )}

      {!isAlternate && (
        <Card className={`evaluation-form ${!isInProgress ? "readonly" : ""}`}>
          <div className="section-head">
            <div>
              <p className="eyebrow">Seu parecer</p>
              <h2>Avaliação final</h2>
            </div>
            {hasSubmitted && (
              <Badge tone="success">
                <Icon name="check" size={12} /> Avaliação enviada
              </Badge>
            )}
          </div>

          {hasSubmitted && (
            <div className="evaluation-complete" role="status">
              <Icon name="check" />
              <div>
                <strong>
                  {DEFENSE_RESULT_LABELS[evaluation.decision] ?? evaluation.decision}
                </strong>
                <span>
                  Enviada em{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Sao_Paulo",
                  }).format(new Date(evaluation.submittedAt))}
                  {evaluation.score && ` · Nota: ${evaluation.score}`}
                </span>
              </div>
            </div>
          )}

          <fieldset disabled={!isInProgress}>
            <div className="field">
              <span>Decisão</span>
              <div className="radio-list decision-radios">
                {DECISION_OPTIONS.map((opt) => (
                  <label key={opt.value}>
                    <input
                      type="radio"
                      name="defense-decision"
                      value={opt.value}
                      checked={decision === opt.value}
                      onChange={() => setDecision(opt.value)}
                    />
                    <span>
                      <strong>{opt.label}</strong>
                      <small>{opt.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <label className="field grade-field">
              <span>
                Nota <small>(0 a 10, opcional)</small>
              </span>
              <div>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.01"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="Ex.: 8.50"
                />
                <b>/ 10</b>
              </div>
            </label>

            <label className="field">
              <span>
                Observações <small>(opcional)</small>
              </span>
              <textarea
                className="feedback-area"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Comentários para o aluno e para a comissão"
                rows={4}
              />
            </label>
          </fieldset>

          {submitError && (
            <div className="success-notice" role="alert">
              {submitError}
            </div>
          )}

          <div className="form-actions">
            {goBack && (
              <Button variant="ghost" onClick={goBack}>
                {hasSubmitted ? "Fechar" : "Cancelar"}
              </Button>
            )}
            {isInProgress && (
              <Button
                variant="success"
                disabled={submitting}
                onClick={() => void submitEvaluation()}
              >
                {submitting
                  ? "Enviando…"
                  : hasSubmitted
                    ? "Atualizar avaliação"
                    : "Registrar avaliação"}
              </Button>
            )}
          </div>

          {isInProgress && (
            <p className="immutable-note">
              <Icon name="lock" size={13} /> A avaliação pode ser atualizada
              enquanto a banca estiver em andamento.
            </p>
          )}

          {isCompleted && (
            <p className="immutable-note">
              <Icon name="lock" size={13} /> Banca encerrada: a avaliação está bloqueada.
            </p>
          )}
        </Card>
      )}
    </div>
  )
}
