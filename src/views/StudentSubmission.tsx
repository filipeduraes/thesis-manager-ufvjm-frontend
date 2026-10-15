import { useState } from "react"
import {
  Badge,
  Button,
  Card,
  Field,
  Icon,
  PageTitle,
  SelectField,
} from "../components/common"

export default function StudentSubmission() {
  // TODO: API Integration - GET /api/v1/theses/me
  // Response: { thesis: Thesis, currentStep: number, upload?: FileMetadata }
  const [upload, setUpload] = useState<"empty" | "loading" | "done" | "error">(
    "empty",
  )
  const [step, setStep] = useState(1)

  // TODO: API Integration - POST /api/v1/theses/submission/files
  // Request: multipart/form-data { file: PDF }; Response: { hash, size, status }
  const startUpload = () => {
    if (upload === "loading") return
    setUpload("loading")
    window.setTimeout(() => setUpload("done"), 900)
  }
  return (
    <div className="page-content">
      <PageTitle eyebrow="Minha monografia" title="Submissão de monografia" />
      <div className="stepper">
        {[
          ["Metadados", "Dados acadêmicos"],
          ["PDF e integridade", "Arquivo principal"],
          ["Acompanhamento", "Status e documentos"],
        ].map((item, i) => (
          <button
            className={
              step === i + 1 ? "active" : step > i + 1 ? "complete" : ""
            }
            onClick={() => setStep(i + 1)}
            key={item[0]}
          >
            <span>
              {step > i + 1 ? <Icon name="check" size={13} /> : i + 1}
            </span>
            <div>
              <strong>{item[0]}</strong>
              <small>{item[1]}</small>
            </div>
          </button>
        ))}
      </div>
      {step === 1 && (
        <Card className="wizard-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Etapa 1 de 3</p>
              <h2>Metadados da monografia</h2>
            </div>
            <Badge tone="neutral">Rascunho</Badge>
          </div>
          <Field
            label="Título da monografia"
            value="Arquiteturas sustentáveis para cidades inteligentes"
          />
          <div className="two-col">
            <SelectField label="Curso">Engenharia de Sistemas</SelectField>
            <SelectField label="Orientador">Buscar docente...</SelectField>
          </div>
          <Field
            label="Palavras-chave"
            value="Cidades inteligentes, Sustentabilidade, IoT"
            hint="Separe os termos com vírgulas"
          />
          <label className="field">
            <span>Resumo</span>
            <textarea defaultValue="Este trabalho investiga soluções de arquitetura sustentável aplicadas ao contexto de cidades inteligentes brasileiras..." />
            <small className="counter">178 / 2.500 caracteres</small>
          </label>
          <div className="form-actions">
            <Button variant="secondary">Salvar rascunho</Button>
            <Button onClick={() => setStep(2)}>Continuar</Button>
          </div>
        </Card>
      )}
      {step === 2 && (
        <Card className="wizard-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Etapa 2 de 3</p>
              <h2>PDF e integridade</h2>
            </div>
            {upload === "done" && (
              <Badge tone="success">Arquivo validado</Badge>
            )}
          </div>
          <div className={`upload-zone ${upload}`} onClick={startUpload}>
            {upload === "empty" && (
              <>
                <div className="upload-icon">
                  <Icon name="upload" />
                </div>
                <strong>Arraste o PDF aqui ou clique para selecionar</strong>
                <span>Somente PDF · máximo 50 MB</span>
                <Button variant="outline">Selecionar arquivo</Button>
              </>
            )}
            {upload === "loading" && (
              <>
                <div className="upload-icon">
                  <Icon name="upload" />
                </div>
                <strong>Enviando monografia_final.pdf</strong>
                <span>32,8 MB de 41,2 MB</span>
                <div className="progress">
                  <i style={{ width: "72%" }} />
                </div>
                <small>72% concluído</small>
              </>
            )}
            {upload === "done" && (
              <>
                <div className="file-done">
                  <div className="upload-icon">
                    <Icon name="file" />
                  </div>
                  <div>
                    <strong>monografia_final_v2.pdf</strong>
                    <span>41,2 MB · PDF</span>
                  </div>
                  <Badge tone="success">
                    <Icon name="check" size={12} /> Concluído
                  </Badge>
                </div>
                <div className="integrity-grid">
                  <div>
                    <span>Hash SHA-256</span>
                    <code>f3b8c2d7...a91e4f02</code>
                  </div>
                  <div>
                    <span>Verificação</span>
                    <Badge tone="light">Integridade validada</Badge>
                  </div>
                  <div>
                    <span>Processamento</span>
                    <strong>Texto extraído</strong>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setUpload("empty")}>
                  Substituir arquivo
                </Button>
              </>
            )}
          </div>
          <div className="form-actions">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button disabled={upload !== "done"} onClick={() => setStep(3)}>
              Continuar
            </Button>
          </div>
        </Card>
      )}
      {step === 3 && (
        <div className="tracking-layout">
          <Card>
            <p className="eyebrow">Etapa 3 de 3</p>
            <h2>Acompanhamento</h2>
            <div className="timeline">
              {[
                "Rascunho",
                "Enviada ao orientador",
                "Aprovada",
                "Defesa",
                "Publicada",
              ].map((x, i) => (
                <div className={i === 0 ? "current" : ""} key={x}>
                  <span>
                    {i === 0 ? <Icon name="check" size={12} /> : i + 1}
                  </span>
                  <div>
                    <strong>{x}</strong>
                    <small>
                      {i === 0
                        ? "Atualizado hoje, 09:42"
                        : "Aguardando etapa anterior"}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div className="section-head">
              <div>
                <p className="eyebrow">Documentação</p>
                <h2>Documentos complementares</h2>
              </div>
            </div>
            {[
              "Ata de defesa",
              "Termo de autorização de publicação",
              "Comprovante de correção ortográfica",
            ].map((x, i) => (
              <div className="document-row" key={x}>
                <div>
                  <Icon name="file" />
                  <span>
                    <strong>{x}</strong>
                    <small>
                      {i === 0
                        ? "Disponível após a defesa"
                        : "PDF · máximo 10 MB"}
                    </small>
                  </span>
                </div>
                <Badge
                  tone={i === 0 ? "neutral" : i === 2 ? "success" : "light"}
                >
                  {i === 0 ? "Bloqueado" : i === 2 ? "Enviado" : "Pendente"}
                </Badge>
                <Button variant="outline" disabled={i === 0}>
                  {i === 2 ? "Substituir" : "Enviar"}
                </Button>
              </div>
            ))}
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Voltar
              </Button>
              <Button>Concluir submissão</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
