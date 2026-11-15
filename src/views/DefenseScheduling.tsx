import { useState } from "react"
import { presentedDefenses } from "../data/mockData"
import { Badge, Button, Card, Icon, PageTitle } from "../components/common"
import DefenseScheduleForm from "./defense/DefenseScheduleForm"

interface DefenseSchedulingProps {
  canEvaluate?: boolean
  onEvaluate?: (defenseId: string) => void
  onOpenCommittee: (defenseId: string) => void
  evaluatedDefenseIds?: string[]
}

export default function DefenseScheduling({
  canEvaluate = false,
  onEvaluate,
  onOpenCommittee,
  evaluatedDefenseIds = [],
}: DefenseSchedulingProps) {
  const [activeView, setActiveView] = useState<"schedule" | "presented">(
    "schedule",
  )
  const [defenseUuid, setDefenseUuid] = useState("")

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="Gestão de bancas"
        title={
          activeView === "schedule"
            ? "Agendar banca de defesa"
            : "Bancas apresentadas"
        }
      />
      {canEvaluate && (
        <div className="defense-tabs" role="tablist">
          <button
            className={activeView === "schedule" ? "active" : ""}
            onClick={() => setActiveView("schedule")}
            role="tab"
            aria-selected={activeView === "schedule"}
          >
            Agendamento
          </button>
          <button
            className={activeView === "presented" ? "active" : ""}
            onClick={() => setActiveView("presented")}
            role="tab"
            aria-selected={activeView === "presented"}
          >
            Bancas apresentadas
            <Badge tone="light">
              {
                presentedDefenses.filter(
                  (defense) =>
                    !defense.evaluated &&
                    !evaluatedDefenseIds.includes(defense.id),
                ).length
              }
            </Badge>
          </button>
        </div>
      )}

      {activeView === "presented" ? (
        <div className="presented-defense-list">
          <Card className="presented-intro">
            <div>
              <Icon name="check" />
            </div>
            <span>
              Consulte as defesas das quais você participou e registre seu
              parecer individual.
            </span>
          </Card>
          {presentedDefenses.map((defense) => {
            const evaluated =
              defense.evaluated || evaluatedDefenseIds.includes(defense.id)

            return (
              <Card className="presented-defense" key={defense.id}>
                <div className="defense-date">
                  <Icon name="calendar" />
                  <span>{defense.date}</span>
                </div>
                <div className="presented-defense-copy">
                  <span className="course">{defense.course}</span>
                  <h3>{defense.thesis}</h3>
                  <p>
                    {defense.student} · Participação: {defense.role}
                  </p>
                </div>
                <Badge tone={evaluated ? "success" : "light"}>
                  {evaluated ? "Avaliação registrada" : "Avaliação pendente"}
                </Badge>
                <Button
                  variant={evaluated ? "secondary" : "outline"}
                  disabled={evaluated}
                  onClick={() => onEvaluate?.(defense.id)}
                >
                  {evaluated ? "Parecer enviado" : "Adicionar avaliação"}
                </Button>
                {onOpenCommittee && (
                  <Button
                    variant="ghost"
                    onClick={() => onOpenCommittee(defense.id)}
                  >
                    Membros
                  </Button>
                )}
              </Card>
            )
          })}

          {/* Acesso direto a uma banca pelo UUID — para integração e testes com o backend */}
          <Card>
            <div className="section-head">
              <div>
                <p className="eyebrow">Acesso direto</p>
                <h3>Abrir banca pelo ID</h3>
              </div>
            </div>
            <label className="field">
              <span>UUID da banca</span>
              <input
                value={defenseUuid}
                onChange={(e) => setDefenseUuid(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
            </label>
            <div className="form-actions">
              <Button
                variant="outline"
                disabled={!defenseUuid.trim()}
                onClick={() => onEvaluate?.(defenseUuid.trim())}
              >
                Avaliar
              </Button>
              {onOpenCommittee && (
                <Button
                  variant="outline"
                  disabled={!defenseUuid.trim()}
                  onClick={() => onOpenCommittee(defenseUuid.trim())}
                >
                  Gerenciar membros
                </Button>
              )}
            </div>
          </Card>
        </div>
      ) : (
        <DefenseScheduleForm onOpenCommittee={onOpenCommittee} />
      )}
    </div>
  )
}
