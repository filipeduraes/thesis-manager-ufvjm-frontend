import { useEffect, useRef, useState } from "react"
import {
  ApiError,
  COMMITTEE_ROLE_LABELS,
  DEFENSE_RESULT_LABELS,
  defenseApi,
  type DefenseCommitteeMember,
  type DefenseData,
  type DefenseMemberEvaluationData,
} from "../api/client"
import { Badge, Button, Card, Icon, PageTitle } from "../components/common"

type DecisionCode = "APPROVED" | "APPROVED_WITH_REMARKS" | "REJECTED"

interface DefenseEvaluationProps {
  /** UUID da defesa a ser avaliada. */
  defenseId: string
  /** E-mail do usuário autenticado; usado para localizar o membro correspondente na banca. */
  userEmail: string
  goBack: () => void
  onSubmitted?: () => void
}

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

const STATUS_BADGE_TONE: Record<string, "light" | "active" | "success" | "dark"> = {
  SCHEDULED: "light",
  IN_PROGRESS: "active",
  COMPLETED: "success",
  CANCELLED: "dark",
}

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
  goBack,
  onSubmitted,
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
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    setLoading(true)
    setLoadError("")
    defenseApi
      .get(defenseId)
      .then(({ defense: data }) => {
        if (!mountedRef.current) return
        setDefense(data)
        const member = data.members.find(
          (m) => m.email.toLowerCase() === userEmail.toLowerCase(),
        )
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
        if (mountedRef.current) setLoading(false)
      })
    return () => {
      mountedRef.current = false
    }
  }, [defenseId, userEmail])

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
      const { evaluation: ev } = await defenseApi.submitEvaluation(
        defenseId,
        myMember.id,
        body,
      )
      setEvaluation(ev)
      setDecision((ev.decision as DecisionCode) ?? "APPROVED")
      setScore(ev.score ?? "")
      setNotes(ev.notes ?? "")
      onSubmitted?.()
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
          <div className="form-actions">
            <Button variant="ghost" onClick={goBack}>
              Voltar
            </Button>
          </div>
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
          <div className="form-actions">
            <Button variant="ghost" onClick={goBack}>
              Voltar
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const isInProgress = defense.status === "IN_PROGRESS"
  const isAlternate = myMember.role === "ALTERNATE"
  const hasSubmitted = evaluation !== null
  const statusTone = STATUS_BADGE_TONE[defense.status] ?? "neutral"

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

      <Card className="thesis-summary">
        <div className="file-icon">
          <Icon name="calendar" />
        </div>
        <div>
          <h3>
            {scheduledDate} · {defense.modalityLabel}
          </h3>
          {defense.location && <span>{defense.location}</span>}
        </div>
        <Badge tone={statusTone}>{defense.statusLabel}</Badge>
        <span>{COMMITTEE_ROLE_LABELS[myMember.role] ?? myMember.roleLabel}</span>
      </Card>

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
          <div className="form-actions">
            <Button variant="ghost" onClick={goBack}>
              Voltar
            </Button>
          </div>
        </Card>
      )}

      {!isAlternate && !isInProgress && (
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
            <Button variant="ghost" onClick={goBack}>
              {hasSubmitted ? "Fechar" : "Cancelar"}
            </Button>
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
        </Card>
      )}
    </div>
  )
}
