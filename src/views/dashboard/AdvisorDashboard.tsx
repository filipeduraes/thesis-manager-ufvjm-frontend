import type { Page } from "../../types"
import { activeAdvisees, advisorReviewQueue } from "../../data/mockData"
import { Badge, Button, Card } from "../../components/common"
interface Props {
  go: (page: Page) => void
  review: (student: string) => void
}
export default function AdvisorDashboard({ go, review }: Props) {
  return (
    <div className="advisor-dashboard">
      <Card className="priority-queue">
        <div className="section-head">
          <div>
            <p className="eyebrow">Ação necessária</p>
            <h2>3 submissões aguardam revisão</h2>
          </div>
          <Badge tone="active">Prioridade</Badge>
        </div>
        <div className="action-list">
          {advisorReviewQueue.map((item) => (
            <div key={item.student}>
              <div>
                <strong>{item.student}</strong>
                <span>{item.thesis}</span>
                <small>{item.deadline}</small>
              </div>
              <Button variant="outline" onClick={() => review(item.student)}>
                Revisar
              </Button>
            </div>
          ))}
        </div>
      </Card>
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
        <div className="advisee-list">
          {activeAdvisees.map((item) => (
            <div key={item.student}>
              <div>
                <strong>{item.student}</strong>
                <span>{item.defense}</span>
              </div>
              <Badge
                tone={
                  item.status === "Aprovada"
                    ? "success"
                    : item.status === "Em avaliação"
                      ? "active"
                      : "neutral"
                }
              >
                {item.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
