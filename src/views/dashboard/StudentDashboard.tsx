import type { Page } from "../../types"
import { Badge, Button, Card, Icon } from "../../components/common"
import ActivityFeed from "./ActivityFeed"
interface Props {
  go: (page: Page) => void
}
export default function StudentDashboard({ go }: Props) {
  return (
    <>
      <Card className="student-hero">
        <div className="student-hero-head">
          <div>
            <p className="eyebrow">Minha monografia</p>
            <h2>Arquiteturas sustentáveis para cidades inteligentes</h2>
            <p>Engenharia de Sistemas · Prof. Ricardo Souza</p>
          </div>
          <Badge tone="active">Em avaliação</Badge>
        </div>
        <div className="steps">
          {["Rascunho", "Aprovação", "Banca", "Avaliação", "Publicada"].map(
            (label, index) => (
              <div className={`step ${index < 2 ? "done" : ""}`} key={label}>
                <span>
                  {index < 2 ? <Icon name="check" size={13} /> : index + 1}
                </span>
                <small>{label}</small>
              </div>
            ),
          )}
        </div>
        <div className="hero-action">
          <strong>Aguardando parecer do orientador</strong>
          <Button onClick={() => go("submission")}>Ver parecer</Button>
        </div>
      </Card>
      <div className="student-widgets">
        <Card>
          <div className="section-head">
            <div>
              <p className="eyebrow">Próximos prazos</p>
              <h3>Agenda</h3>
            </div>
          </div>
          <div className="deadline-list">
            <div>
              <strong>18 jun</strong>
              <span>Retorno do orientador</span>
            </div>
            <div>
              <strong>25 jun</strong>
              <span>Documentos complementares</span>
            </div>
          </div>
        </Card>
        <ActivityFeed />
      </div>
    </>
  )
}
