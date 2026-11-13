import { useCallback, useEffect, useState } from "react"
import { thesesApi, type StudentThesisContext, type Thesis } from "../../api/client"
import { Badge, Button, Card, Icon } from "../../components/common"
import { formatDate, formatDateTime, thesisStatusTone, workflowSteps } from "../../data/thesisStatus"
import type { Page } from "../../types"
import ActivityFeed, { type ActivityItem } from "./ActivityFeed"

interface Props {
  go: (page: Page) => void
}

interface NextAction {
  title: string
  description: string
  action: string
  page: Page
}

function nextActionFor(thesis: Thesis): NextAction {
  switch (thesis.status) {
    case "DRAFT":
      return {
        title: "Complete a submissão",
        description: "Informe os metadados e envie o PDF da monografia para iniciar a orientação.",
        action: "Continuar submissão",
        page: "submission",
      }
    case "CHANGES_REQUESTED":
      return {
        title: "Ajustes solicitados pelo orientador",
        description: "Leia o parecer, atualize o arquivo e envie uma nova versão.",
        action: "Revisar e reenviar",
        page: "submission",
      }
    case "REJECTED":
      return {
        title: "Submissão reprovada",
        description: "Consulte o parecer do orientador e envie uma nova versão para continuar.",
        action: "Enviar nova versão",
        page: "submission",
      }
    case "SUBMITTED":
    case "ADVISOR_REVIEW":
      return {
        title: "Aguardando parecer do orientador",
        description: "Sua monografia está em análise. Você será notificado quando houver um parecer.",
        action: "Ver acompanhamento",
        page: "submission",
      }
    case "ADVISOR_APPROVED":
    case "READY_FOR_DEFENSE":
      return {
        title: "Aprovada pelo orientador",
        description: "A coordenação já pode agendar a banca de defesa.",
        action: "Acompanhar",
        page: "submission",
      }
    case "DEFENSE_SCHEDULED":
      return {
        title: "Banca agendada",
        description: "Prepare-se para a defesa. Consulte a data e os membros da banca.",
        action: "Ver acompanhamento",
        page: "submission",
      }
    case "UNDER_EVALUATION":
      return {
        title: "Banca em avaliação",
        description: "A banca está registrando os pareceres. O resultado será divulgado em breve.",
        action: "Ver acompanhamento",
        page: "submission",
      }
    case "APPROVED":
    case "APPROVED_WITH_REMARKS":
      return {
        title: "Aprovada pela banca",
        description: "Aguarde a validação dos documentos complementares e a publicação no repositório.",
        action: "Acompanhar",
        page: "submission",
      }
    case "CORRECTIONS_PENDING":
      return {
        title: "Correções pendentes",
        description: "Envie a versão corrigida e os documentos exigidos para concluir a publicação.",
        action: "Enviar correções",
        page: "submission",
      }
    case "PUBLISHED":
      return {
        title: "Monografia publicada",
        description: "Seu trabalho está disponível no repositório institucional.",
        action: "Abrir repositório",
        page: "repository",
      }
    default:
      return {
        title: "Acompanhe sua monografia",
        description: thesis.statusDescription,
        action: "Ver detalhes",
        page: "submission",
      }
  }
}

function activityIcon(status: string): string {
  if (status === "REJECTED" || status === "CHANGES_REQUESTED") return "alert"
  if (status === "PUBLISHED" || status === "APPROVED" || status === "APPROVED_WITH_REMARKS") return "check"
  if (status === "ADVISOR_APPROVED" || status === "READY_FOR_DEFENSE") return "check"
  if (status === "DEFENSE_SCHEDULED" || status === "UNDER_EVALUATION") return "calendar"
  return "file"
}

export default function StudentDashboard({ go }: Props) {
  const [context, setContext] = useState<StudentThesisContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await thesesApi.myThesis()
      setContext(data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar sua monografia.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const thesis = context?.thesis ?? null

  if (loading) {
    return (
      <Card>
        <div className="pdf-feedback">
          <div className="upload-icon">
            <Icon name="file" />
          </div>
          <strong>Carregando sua monografia…</strong>
          <span>Buscando status, versões e pareceres.</span>
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
          <h2>Não foi possível carregar sua monografia</h2>
          <p>{error}</p>
          <Button onClick={() => void load()}>Tentar novamente</Button>
        </div>
      </Card>
    )
  }

  if (!thesis) {
    return (
      <>
        <Card className="student-hero">
          <div className="student-hero-head">
            <div>
              <p className="eyebrow">Minha monografia</p>
              <h2>Nenhuma monografia cadastrada</h2>
              <p>Preencha os dados acadêmicos e envie o PDF para iniciar sua submissão.</p>
            </div>
            <Badge tone="neutral">Rascunho</Badge>
          </div>
          <div className="hero-action">
            <div>
              <strong>Comece pela submissão</strong>
              <p>Somente arquivos PDF são aceitos, com limite configurável de 50 MB.</p>
            </div>
            <Button icon="upload" onClick={() => go("submission")}>
              Iniciar submissão
            </Button>
          </div>
        </Card>
        <div className="student-widgets">
          <Card>
            <div className="section-head">
              <div>
                <p className="eyebrow">Próximos passos</p>
                <h3>Antes de enviar</h3>
              </div>
            </div>
            <div className="deadline-list">
              <div>
                <strong>1</strong>
                <span>Defina título, curso, orientador e palavras-chave.</span>
              </div>
              <div>
                <strong>2</strong>
                <span>Envie o PDF finalizado com o resumo revisado.</span>
              </div>
              <div>
                <strong>3</strong>
                <span>Acompanhe o parecer do orientador nesta página.</span>
              </div>
            </div>
          </Card>
          <ActivityFeed items={[]} emptyMessage="As movimentações aparecerão após a criação do rascunho." />
        </div>
      </>
    )
  }

  const next = nextActionFor(thesis)
  const latestReview = thesis.reviews?.[0] ?? null
  const documents = thesis.documents ?? []
  const pendingDocuments = documents.filter((document) => document.status !== "VALIDATED")
  const history = thesis.statusHistory ?? []
  const activityItems: ActivityItem[] = history.slice(0, 5).map((entry) => ({
    id: entry.id,
    title: entry.newStatusLabel,
    description: `${formatDateTime(entry.changedAt)}${entry.changedBy ? ` · ${entry.changedBy.name}` : ""}`,
    icon: activityIcon(entry.newStatus),
  }))

  return (
    <>
      <Card className="student-hero">
        <div className="student-hero-head">
          <div>
            <p className="eyebrow">Minha monografia</p>
            <h2>{thesis.title}</h2>
            <p>
              {thesis.course.name} · {thesis.advisor.name}
            </p>
          </div>
          <Badge tone={thesisStatusTone(thesis.status)}>{thesis.statusLabel}</Badge>
        </div>
        <div className="steps">
          {workflowSteps.map((label, index) => {
            const done = index < thesis.progressStep - 1
            const current = index === thesis.progressStep - 1
            return (
              <div className={`step ${done ? "done" : ""} ${current ? "current" : ""}`} key={label}>
                <span>{done ? <Icon name="check" size={13} /> : index + 1}</span>
                <small>{label}</small>
              </div>
            )
          })}
        </div>
        <div className="hero-action">
          <div>
            <strong>{next.title}</strong>
            <p>{next.description}</p>
          </div>
          <Button onClick={() => go(next.page)}>{next.action}</Button>
        </div>
      </Card>

      <div className="student-widgets">
        <Card>
          <div className="section-head">
            <div>
              <p className="eyebrow">Situação atual</p>
              <h3>Resumo do acompanhamento</h3>
            </div>
          </div>
          <dl className="meta-list">
            <div>
              <dt>Referência</dt>
              <dd>{thesis.referenceCode}</dd>
            </div>
            <div>
              <dt>Versão atual</dt>
              <dd>{thesis.currentFile ? `v${thesis.currentFile.versionNumber}` : "Sem arquivo"}</dd>
            </div>
            <div>
              <dt>Enviada em</dt>
              <dd>{formatDate(thesis.submittedAt)}</dd>
            </div>
            <div>
              <dt>Pareceres</dt>
              <dd>{thesis.reviews?.length ?? 0}</dd>
            </div>
            <div>
              <dt>Documentos pendentes</dt>
              <dd>{pendingDocuments.length}</dd>
            </div>
          </dl>
          {latestReview && (
            <div className="review-summary compact">
              <strong>{latestReview.decisionLabel}</strong>
              <p>{latestReview.comments || "Sem comentários adicionais."}</p>
              <small>
                {latestReview.reviewer?.name ?? "Orientador"} · {formatDateTime(latestReview.reviewedAt)}
              </small>
            </div>
          )}
          {!latestReview && (
            <div className="inline-alert">
              <Icon name="clock" />
              <span>Nenhum parecer registrado até o momento.</span>
            </div>
          )}
        </Card>
        <ActivityFeed items={activityItems} emptyMessage="As movimentações aparecerão conforme a monografia avançar." />
      </div>
    </>
  )
}
