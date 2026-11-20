import { useEffect, useState } from "react"
import { defenseApi, type DefenseData, type ExternalAssignment, type SessionPayload } from "../api/client"
import { Badge, Button, Card, Icon, Logo } from "../components/common"
import { defenseStatusTone } from "../data/defenseStatus"
import DefenseEvaluation from "./DefenseEvaluation"
import { formatDefenseTimeRange } from "./defense/defenseSchedule"

const EXPIRATION_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
})

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
})

type AssignmentDetail =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; defense: DefenseData }

interface ExternalEvaluationProps {
  goLogin: () => void
  externalSession?: SessionPayload["externalInvitation"]
}

interface AssignmentListProps {
  assignments: ExternalAssignment[]
  onSelect: (assignment: ExternalAssignment) => void
}

/** Lists the defenses of the invitation so the member can pick one. */
function AssignmentList({ assignments, onSelect }: AssignmentListProps) {
  const [details, setDetails] = useState<Record<string, AssignmentDetail>>({})

  useEffect(() => {
    let cancelled = false
    // GET /defenses responde 403 para sessões externas; o detalhe de cada banca é permitido.
    assignments.forEach((assignment) => {
      setDetails((current) => ({ ...current, [assignment.defenseId]: { status: "loading" } }))
      defenseApi
        .get(assignment.defenseId)
        .then(({ defense }) => {
          if (!cancelled) setDetails((current) => ({ ...current, [assignment.defenseId]: { status: "ready", defense } }))
        })
        .catch((reason: unknown) => {
          if (cancelled) return
          const message = reason instanceof Error && reason.message ? reason.message : "Não foi possível carregar a banca."
          setDetails((current) => ({ ...current, [assignment.defenseId]: { status: "error", message } }))
        })
    })
    return () => {
      cancelled = true
    }
  }, [assignments])

  return (
    <Card>
      <h1>Escolha a banca</h1>
      <p>Seu convite dá acesso a mais de uma banca. Selecione a que deseja abrir.</p>
      <div className="selection-list external-assignments">
        {assignments.map((assignment) => {
          const detail = details[assignment.defenseId] ?? { status: "loading" }
          return (
            <button key={assignment.memberId} type="button" onClick={() => onSelect(assignment)}>
              <div>
                {detail.status === "ready" ? (
                  <>
                    <strong>
                      {DATE_FORMATTER.format(new Date(detail.defense.scheduledDatetime))} ·{" "}
                      {formatDefenseTimeRange(detail.defense.scheduledDatetime, detail.defense.durationMinutes)}
                    </strong>
                    <span>
                      {detail.defense.modalityLabel}
                      {detail.defense.location ? ` · ${detail.defense.location}` : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <strong>Banca</strong>
                    <span role={detail.status === "error" ? "alert" : undefined}>
                      {detail.status === "error" ? detail.message : "Carregando dados da banca…"}
                    </span>
                  </>
                )}
              </div>
              {detail.status === "ready" && (
                <Badge tone={defenseStatusTone(detail.defense.status)}>{detail.defense.statusLabel}</Badge>
              )}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

/**
 * Workspace of an external committee member authenticated by invitation token.
 *
 * Uses `externalInvitation.assignments` from `GET /api/v1/session`: with one defense it
 * opens it directly, with more it lists them first. The defense screen reuses
 * `DefenseEvaluation` (details, availability while SCHEDULED, evaluation while IN_PROGRESS).
 */
export default function ExternalEvaluation({ goLogin, externalSession }: ExternalEvaluationProps) {
  const assignments = externalSession?.assignments ?? []
  const singleAssignment = assignments.length === 1 ? assignments[0] : undefined
  const [selected, setSelected] = useState<ExternalAssignment | null>(null)
  const current = singleAssignment ?? selected

  return (
    <main className="external-workspace">
      <header className="external-header">
        <Logo />
        <span>Acesso temporário de banca</span>
        <Button variant="ghost" icon="logout" onClick={goLogin}>
          Encerrar sessão
        </Button>
      </header>
      <div className="external-content">
        {externalSession ? (
          <>
            <div className="institutional-banner session-banner">
              <Icon name="lock" />
              <div>
                <strong>Sessão autenticada</strong>
                <span>
                  {externalSession.name} · {externalSession.email}
                </span>
                {externalSession.institution && <span>{externalSession.institution}</span>}
                <span>A sessão expira em {EXPIRATION_FORMATTER.format(new Date(externalSession.expiresAt))}.</span>
              </div>
              <Badge tone="success">Ativa</Badge>
            </div>

            {current ? (
              <DefenseEvaluation
                key={current.memberId}
                defenseId={current.defenseId}
                memberId={current.memberId}
                goBack={singleAssignment ? undefined : () => setSelected(null)}
                variant="external"
              />
            ) : assignments.length > 1 ? (
              <AssignmentList assignments={assignments} onSelect={setSelected} />
            ) : (
              <Card className="evaluation-form">
                <h1>Nenhuma banca vinculada</h1>
                <p>
                  Seu convite não está vinculado a nenhuma banca no momento. Procure a coordenação do curso ou o
                  orientador que enviou o token.
                </p>
              </Card>
            )}
          </>
        ) : (
          <Card className="evaluation-form">
            <h1>Dados do convite indisponíveis</h1>
            <p role="alert">
              Não foi possível carregar os dados do seu convite. Encerre a sessão e entre novamente com o token
              recebido.
            </p>
          </Card>
        )}
      </div>
    </main>
  )
}
