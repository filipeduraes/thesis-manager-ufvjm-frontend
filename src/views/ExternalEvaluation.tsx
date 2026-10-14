import { useState } from "react"
import { presentedDefenses } from "../data/mockData"
import { Badge, Button, Card, Icon, Logo } from "../components/common"

interface ExternalEvaluationProps {
  mode?: "external" | "internal"
  defenseId?: string
  goLogin: () => void
  goBack: () => void
  onSubmitted?: (defenseId?: string) => void
}

export default function ExternalEvaluation({
  mode = "external",
  defenseId,
  goLogin,
  goBack,
  onSubmitted,
}: ExternalEvaluationProps) {
  // TODO: API Integration - GET /api/v1/external-evaluations/session
  // Response: { thesis: Thesis, tokenExpiresAt: string, evaluation?: Evaluation }
  const [submitted, setSubmitted] = useState(false)
  const internalDefense = presentedDefenses.find(
    (defense) => defense.id === defenseId,
  )
  const isInternal = mode === "internal"
  const leaveEvaluation = isInternal ? goBack : goLogin
  // TODO: API Integration - POST /api/v1/external-evaluations
  // Request: { grade, feedback, decision }; Response: { evaluationId, submittedAt }
  return (
    <main className="external-workspace">
      <header className="external-header">
        <Logo />
        <span>Avaliação de banca</span>
        <Button variant="ghost" icon="logout" onClick={leaveEvaluation}>
          {isInternal ? "Voltar para bancas" : "Voltar para o login"}
        </Button>
      </header>
      {isInternal ? (
        <div className="institutional-banner session-banner">
          <Icon name="users" />
          <div>
            <strong>Acesso institucional</strong>
            <span>
              Você está avaliando como integrante da comissão desta defesa.
            </span>
          </div>
          <Badge tone="success">Membro confirmado</Badge>
        </div>
      ) : (
        <div className="token-banner session-banner">
          <Icon name="lock" />
          <div>
            <strong>Sessão temporária</strong>
            <span>Token UFVJM-8H4K-22 · expira em 03h 42min</span>
          </div>
          <Badge tone="success">Ativa</Badge>
        </div>
      )}
      <div className="external-content">
        <div className="external-title">
          <div>
            <p className="eyebrow">
              Banca de defesa · {internalDefense?.date ?? "27 jun 2025"}
            </p>
            <h1>
              {internalDefense?.thesis ??
                "Arquiteturas sustentáveis para cidades inteligentes"}
            </h1>
            <p>
              {internalDefense
                ? `${internalDefense.student} · ${internalDefense.course}`
                : "Marina Alves · Engenharia de Sistemas"}
            </p>
          </div>
          {submitted && <Badge tone="success">Avaliação registrada</Badge>}
        </div>
        <div className="evaluation-split">
          <Card className="pdf-viewer evaluation-reader">
            <div className="pdf-toolbar">
              <span>
                <Icon name="file" /> monografia_final_v2.pdf
              </span>
              <div className="pdf-controls">
                <button>−</button>
                <strong>100%</strong>
                <button>+</button>
                <span>1 / 24</span>
                <Button variant="ghost" icon="download">
                  Baixar
                </Button>
              </div>
            </div>
            <div className="pdf-page">
              <div className="pdf-lines">
                <b />
                <i />
                <i />
                <i />
                <i />
              </div>
              <span>Visualizador de PDF</span>
            </div>
          </Card>
          <Card className={`evaluation-form ${submitted ? "readonly" : ""}`}>
            <div className="section-head">
              <div>
                <p className="eyebrow">Seu parecer</p>
                <h2>Avaliação final</h2>
              </div>
              {submitted && (
                <Badge tone="light">
                  <Icon name="lock" size={12} /> Somente leitura
                </Badge>
              )}
            </div>
            {submitted && (
              <div className="evaluation-complete" role="status">
                <Icon name="check" />
                <div>
                  <strong>Avaliação registrada com sucesso</strong>
                  <span>
                    Seu parecer foi vinculado à ata desta banca e não poderá
                    mais ser alterado.
                  </span>
                </div>
              </div>
            )}
            <fieldset disabled={submitted}>
              <label className="field grade-field">
                <span>
                  Nota final <small>(0 a 10)</small>
                </span>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    defaultValue="8.7"
                  />
                  <b>/ 10</b>
                </div>
              </label>
              <label className="field">
                <span>Feedback para o aluno</span>
                <textarea
                  className="feedback-area"
                  defaultValue="O trabalho apresenta contribuição relevante, com metodologia adequada e resultados bem fundamentados. Recomenda-se revisar as referências conforme as normas institucionais."
                />
                <small className="counter">236 / 2.500 caracteres</small>
              </label>
              <div className="field">
                <span>Decisão final</span>
                <div className="radio-list decision-radios">
                  {["Aprovado", "Aprovado com correções", "Reprovado"].map(
                    (r, i) => (
                      <label key={r}>
                        <input
                          type="radio"
                          name="rec"
                          defaultChecked={i === 1}
                        />
                        <span>
                          <strong>{r}</strong>
                          <small>
                            {i === 0
                              ? "Apto para publicação"
                              : i === 1
                                ? "Requer ajustes antes da publicação"
                                : "Não atende aos critérios da banca"}
                          </small>
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </div>
            </fieldset>
            <div className="form-actions">
              {submitted ? (
                <Button variant="success" onClick={leaveEvaluation}>
                  {isInternal
                    ? "Concluir e voltar para bancas"
                    : "Concluir e voltar para o login"}
                </Button>
              ) : (
                <>
                  <Button variant="secondary">Salvar rascunho</Button>
                  <Button
                    variant="success"
                    onClick={() => {
                      setSubmitted(true)
                      onSubmitted?.(defenseId)
                    }}
                  >
                    Registrar avaliação
                  </Button>
                </>
              )}
            </div>
            {!submitted && (
              <p className="immutable-note">
                <Icon name="lock" size={13} /> Após o envio, a avaliação não
                poderá ser alterada.
              </p>
            )}
          </Card>
        </div>
      </div>
    </main>
  )
}
