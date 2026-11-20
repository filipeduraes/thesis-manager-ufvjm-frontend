import { useCallback, useEffect, useState } from "react"
import { defenseApi, thesesApi, type DefenseListItem, type ThesisListItem } from "../../api/client"
import { Badge, Button, Card, Icon } from "../../components/common"
import { formatDateTime, thesisStatusTone } from "../../data/thesisStatus"
import type { Page } from "../../types"

interface Props {
  go: (page: Page) => void
  review: (thesisId: string) => void
  evaluate: (defenseId: string) => void
}

export default function AdvisorDashboard({ go, review, evaluate }: Props) {
  const [pending, setPending] = useState<ThesisListItem[]>([])
  // A lista traz só as primeiras linhas (pageSize); o total real vem do `count` da API.
  const [pendingTotal, setPendingTotal] = useState(0)
  const [advisees, setAdvisees] = useState<ThesisListItem[]>([])
  const [pendingEvaluations, setPendingEvaluations] = useState<DefenseListItem[]>([])
  const [pendingEvaluationsTotal, setPendingEvaluationsTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const [pendingData, adviseeData, evaluationData] = await Promise.all([
        thesesApi.list({ scope: "advised", pendingReview: true, pageSize: 5 }),
        thesesApi.list({ scope: "advised", pageSize: 6 }),
        defenseApi.list({ pendingEvaluation: true, pageSize: 5 }),
      ])
      setPending(pendingData.results)
      setPendingTotal(pendingData.count)
      setAdvisees(adviseeData.results)
      setPendingEvaluations(evaluationData.results)
      setPendingEvaluationsTotal(evaluationData.count)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar seus orientandos.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <Card>
        <div className="pdf-feedback">
          <div className="upload-icon">
            <Icon name="users" />
          </div>
          <strong>Carregando orientandos…</strong>
          <span>Buscando submissões e pendências de revisão.</span>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <div className="empty-state">
          <div>
            <Icon name="alert" />
          </div>
          <h2>Não foi possível carregar os orientandos</h2>
          <p>{error}</p>
          <Button onClick={() => void load()}>Tentar novamente</Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="advisor-dashboard">
      <Card className="priority-queue">
        <div className="section-head">
          <div>
            <p className="eyebrow">Ação necessária</p>
            <h2>
              {pendingTotal > 0
                ? pendingTotal === 1
                  ? "1 submissão aguarda revisão"
                  : `${pendingTotal} submissões aguardam revisão`
                : "Nenhuma submissão aguardando revisão"}
            </h2>
          </div>
          <Badge tone={pendingTotal > 0 ? "active" : "neutral"}>
            {pendingTotal > 0 ? "Prioridade" : "Em dia"}
          </Badge>
        </div>
        {pendingTotal === 0 ? (
          <div className="empty-state compact">
            <div>
              <Icon name="check" />
            </div>
            <h3>Tudo em dia</h3>
            <p>Você não tem pareceres pendentes neste momento.</p>
          </div>
        ) : (
          <div className="action-list">
            {pending.map((item) => (
              <div key={item.id}>
                <div>
                  <strong>{item.student?.name ?? "Aluno"}</strong>
                  <span>{item.title}</span>
                  <small>
                    {item.currentVersion ? `v${item.currentVersion} · ` : ""}
                    {formatDateTime(item.submittedAt)}
                  </small>
                </div>
                <Button variant="outline" onClick={() => review(item.id)}>
                  Revisar
                </Button>
              </div>
            ))}
            {pendingTotal > pending.length && (
              <button type="button" className="text-link" onClick={() => go("approval")}>
                {`Ver todas as ${pendingTotal} pendências`}
              </button>
            )}
          </div>
        )}
      </Card>

      {pendingEvaluationsTotal > 0 && (
        <Card>
          <div className="section-head">
            <div>
              <p className="eyebrow">Bancas</p>
              <h2>Bancas a avaliar</h2>
            </div>
            <Badge tone="active">
              {pendingEvaluationsTotal === 1 ? "1 pendente" : `${pendingEvaluationsTotal} pendentes`}
            </Badge>
          </div>
          <div className="action-list">
            {pendingEvaluations.map((defense) => (
              <div key={defense.id}>
                <div>
                  <strong>{defense.thesisTitle}</strong>
                  <span>{defense.student?.name ?? defense.statusLabel}</span>
                  <small>
                    {formatDateTime(defense.scheduledDatetime)} · {defense.statusLabel}
                  </small>
                </div>
                <Button variant="outline" onClick={() => evaluate(defense.id)}>
                  Avaliar
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="section-head">
          <div>
            <p className="eyebrow">Orientandos</p>
            <h2>Acompanhamento ativo</h2>
          </div>
          <button className="text-link" onClick={() => go("approval")}>
            Ver todos
          </button>
        </div>
        {advisees.length === 0 ? (
          <div className="empty-state compact">
            <div>
              <Icon name="users" />
            </div>
            <h3>Sem orientandos</h3>
            <p>As monografias sob sua orientação aparecerão aqui.</p>
          </div>
        ) : (
          <div className="advisee-list">
            {advisees.map((item) => (
              <div key={item.id}>
                <div>
                  <strong>{item.student?.name ?? "Aluno"}</strong>
                  <span>{item.title}</span>
                </div>
                <Badge tone={thesisStatusTone(item.status)}>{item.statusLabel}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
