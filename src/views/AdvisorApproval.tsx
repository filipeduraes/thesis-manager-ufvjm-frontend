import { useState } from "react"
import { advisorSubmissions, submissionDetails } from "../data/mockData"
import {
  Badge,
  Button,
  Card,
  Icon,
  Modal,
  PageTitle,
  Pagination,
} from "../components/common"

export default function AdvisorApproval({
  initialStudent,
}: {
  initialStudent?: string
}) {
  // TODO: API Integration - GET /api/v1/advisor/submissions
  // Response: { submissions: Thesis[], selectedSubmission?: Thesis }
  const [selected, setSelected] = useState(Boolean(initialStudent))
  const [selectedName, setSelectedName] = useState(
    initialStudent || "Marina Alves",
  )
  const [modal, setModal] = useState(false)
  const [rejectModal, setRejectModal] = useState(false)

  // TODO: API Integration - PATCH /api/v1/advisor/submissions/:thesisId
  // Request: { decision, feedback }; Response: { thesis: Thesis }
  const selectedSubmission =
    submissionDetails[selectedName] || submissionDetails["Marina Alves"]
  const selectedTitle = selectedSubmission.title
  const selectedCourse = selectedSubmission.course
  if (selected)
    return (
      <div className="page-content">
        <div className="breadcrumb">
          <button onClick={() => setSelected(false)}>Orientandos</button>
          <Icon name="arrow" size={14} />
          <span>Detalhe da submissão</span>
        </div>
        <PageTitle
          eyebrow="Submissão #TCC-2025-0148"
          title={selectedTitle}
          subtitle={`${selectedName} · ${selectedCourse}`}
          action={<Badge tone="active">Em avaliação</Badge>}
        />
        <div className="review-split">
          <div className="review-media">
            <Card className="pdf-viewer review-pdf">
              <div className="pdf-toolbar">
                <span>
                  <Icon name="file" /> monografia_final_v2.pdf
                </span>
                <div className="pdf-controls">
                  <button aria-label="Diminuir zoom">−</button>
                  <strong>100%</strong>
                  <button aria-label="Aumentar zoom">+</button>
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
            <Card className="version-drawer">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Arquivos</p>
                  <h3>Histórico de versões</h3>
                </div>
                <Badge tone="success">SHA-256 validado</Badge>
              </div>
              <div className="version">
                <div>
                  <Badge tone="active">v2 · Atual</Badge>
                  <strong>17 jun 2025, 09:40</strong>
                  <span>41,2 MB</span>
                </div>
                <Button variant="outline">Comparar</Button>
              </div>
              <div className="version">
                <div>
                  <Badge tone="neutral">v1</Badge>
                  <strong>10 jun 2025, 15:22</strong>
                  <span>38,6 MB</span>
                </div>
                <Button variant="ghost" icon="download">
                  Baixar
                </Button>
              </div>
            </Card>
          </div>
          <aside className="review-decision">
            <Card>
              <p className="eyebrow">Resumo do aluno</p>
              <h3>{selectedName}</h3>
              <dl className="meta-list">
                <div>
                  <dt>Curso</dt>
                  <dd>{selectedCourse}</dd>
                </div>
                <div>
                  <dt>Orientador</dt>
                  <dd>Prof. Ricardo Souza</dd>
                </div>
                <div>
                  <dt>Palavras-chave</dt>
                  <dd>
                    <Badge tone="light">Sustentabilidade</Badge>{" "}
                    <Badge tone="light">IoT</Badge>
                  </dd>
                </div>
              </dl>
            </Card>
            <Card className="decision-card">
              <div>
                <p className="eyebrow">Decisão</p>
                <h2>Parecer do orientador</h2>
              </div>
              <label className="field">
                <span>Comentários e recomendações</span>
                <textarea
                  className="feedback-area"
                  placeholder="Registre pontos fortes, ajustes e orientações para a próxima etapa..."
                />
              </label>
              <div className="inline-alert">
                <Icon name="alert" />
                <span>
                  A aprovação libera o trabalho para agendamento da banca.
                </span>
              </div>
              <div className="button-stack">
                <Button
                  variant="success"
                  icon="check"
                  onClick={() => setModal(true)}
                >
                  Aprovar para banca
                </Button>
                <Button variant="outline">Solicitar ajustes</Button>
                <button
                  className="btn btn-danger"
                  onClick={() => setRejectModal(true)}
                >
                  Reprovar submissão
                </button>
              </div>
            </Card>
          </aside>
        </div>
        {modal && (
          <Modal>
            <div className="modal-icon">
              <Icon name="check" />
            </div>
            <h2>Aprovar para banca?</h2>
            <p>
              Ao confirmar, a coordenação poderá agendar a defesa e o aluno será
              notificado.
            </p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setModal(false)}>
                Cancelar
              </Button>
              <Button variant="success" onClick={() => setModal(false)}>
                Confirmar aprovação
              </Button>
            </div>
          </Modal>
        )}
        {rejectModal && (
          <Modal>
            <div className="modal-icon danger">
              <Icon name="alert" />
            </div>
            <h2>Reprovar submissão?</h2>
            <p>
              O aluno será notificado e deverá enviar uma nova versão antes de
              prosseguir.
            </p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setRejectModal(false)}>
                Cancelar
              </Button>
              <button
                className="btn btn-danger-solid"
                onClick={() => setRejectModal(false)}
              >
                Confirmar reprovação
              </button>
            </div>
          </Modal>
        )}
      </div>
    )
  return (
    <div className="page-content">
      <PageTitle
        eyebrow="Orientação acadêmica"
        title="Acompanhamento e aprovação"
      />
      <Card>
        <div className="filterbar">
          <div className="top-search">
            <Icon name="search" />
            <input placeholder="Buscar aluno ou título..." />
          </div>
          <select>
            <option>Status: Todos</option>
            <option>Em avaliação</option>
            <option>Aprovada</option>
          </select>
          <select>
            <option>Curso: Todos</option>
          </select>
          <select>
            <option>Ano: 2025</option>
          </select>
          <Button variant="secondary" icon="filter">
            Filtrar
          </Button>
        </div>
        <div className="full-table">
          <div className="row head">
            <span>Aluno / Monografia</span>
            <span>Curso</span>
            <span>Envio</span>
            <span>Status</span>
            <span>Versão</span>
            <span />
          </div>
          {advisorSubmissions.map((submission) => (
            <button
              className="row"
              key={submission.student}
              onClick={() => {
                setSelectedName(submission.student)
                setSelected(true)
              }}
            >
              <span>
                <strong>{submission.student}</strong>
                <small>{submission.title}</small>
              </span>
              <span>{submission.course}</span>
              <span>{submission.submittedAt}</span>
              <span>
                <Badge
                  tone={
                    submission.status === "Aprovada"
                      ? "success"
                      : submission.status === "Em avaliação"
                        ? "active"
                        : "neutral"
                  }
                >
                  {submission.status === "Reprovada" && (
                    <Icon name="alert" size={12} />
                  )}{" "}
                  {submission.status}
                </Badge>
              </span>
              <span>{submission.version}</span>
              <Icon name="arrow" />
            </button>
          ))}
        </div>
        <Pagination />
      </Card>
    </div>
  )
}
