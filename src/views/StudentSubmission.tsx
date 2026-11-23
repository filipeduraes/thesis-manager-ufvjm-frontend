import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { DragEvent } from "react"
import {
  thesesApi,
  type StudentThesisContext,
  type Thesis,
  type ThesisDocumentType,
  type ThesisFile,
  type ThesisMetadataInput,
  type UserSuggestion,
} from "../api/client"
import { apiErrorMessage } from "../api/errors"
import {
  Badge,
  Button,
  Card,
  CoauthorPicker,
  Field,
  Icon,
  PageTitle,
  PdfViewer,
  SelectField,
} from "../components/common"
import { validatePdfFile } from "../data/pdfFile"
import {
  documentStatusLabels,
  documentStatusTones,
  documentTypeOptions,
  formatBytes,
  formatDateTime,
  shortHash,
  thesisStatusTone,
  workflowSteps,
} from "../data/thesisStatus"

const defaultForm = {
  title: "",
  abstract: "",
  courseId: "",
  advisorId: "",
  keywords: "",
  authors: [] as UserSuggestion[],
}

function coauthorsOf(thesis: Thesis): UserSuggestion[] {
  return thesis.authors
    .filter((author) => !author.isMainAuthor && author.user)
    .map((author) => ({ id: author.user!.id, name: author.user!.name, email: author.user!.email, avatarUrl: null }))
}

function parseKeywords(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index)
}

export default function StudentSubmission() {
  const [context, setContext] = useState<StudentThesisContext | null>(null)
  const [thesis, setThesis] = useState<Thesis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [uploadError, setUploadError] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [changeDescription, setChangeDescription] = useState("")
  const [form, setForm] = useState(defaultForm)
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [documentType, setDocumentType] = useState<ThesisDocumentType>("PUBLICATION_AUTHORIZATION")
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [documentUploading, setDocumentUploading] = useState(false)
  const [documentError, setDocumentError] = useState("")
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)

  const applyThesis = useCallback((next: Thesis) => {
    setThesis(next)
    setContext((current) => (current ? { ...current, thesis: next } : current))
    setForm({
      title: next.title,
      abstract: next.abstract,
      courseId: next.course.id,
      advisorId: next.advisor.id,
      keywords: next.keywords.join(", "),
      authors: coauthorsOf(next),
    })
    setActiveFileId(next.currentFile?.id ?? null)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const data = await thesesApi.myThesis()
      setContext(data)
      if (data.thesis) {
        setThesis(data.thesis)
        setForm({
          title: data.thesis.title,
          abstract: data.thesis.abstract,
          courseId: data.thesis.course.id,
          advisorId: data.thesis.advisor.id,
          keywords: data.thesis.keywords.join(", "),
          authors: coauthorsOf(data.thesis),
        })
        setActiveFileId(data.thesis.currentFile?.id ?? null)
        setStep(3)
      } else {
        setThesis(null)
        setForm({
          ...defaultForm,
          courseId: data.defaultCourseId ?? data.courses[0]?.id ?? "",
          advisorId: data.advisors[0]?.id ?? "",
        })
        setStep(1)
      }
    } catch (reason) {
      setError(apiErrorMessage(reason))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const canEdit = thesis ? thesis.permissions.canEdit : true
  const canSubmit = thesis?.permissions.canSubmit ?? false
  const canWithdrawSubmission = thesis?.permissions.canWithdrawSubmission ?? false
  const canUploadDocuments = thesis?.permissions.canUploadDocuments ?? false
  const isCorrectionResubmission =
    thesis?.status === "CHANGES_REQUESTED" || thesis?.status === "REJECTED"
  const currentFile = thesis?.currentFile ?? null
  const files = useMemo(() => thesis?.files ?? [], [thesis])
  const activeFile = useMemo(
    () => files.find((item) => item.id === activeFileId) ?? currentFile ?? files[0] ?? null,
    [activeFileId, currentFile, files],
  )
  const latestReview = thesis?.reviews?.[0] ?? null
  const maxKeywords = context?.limits.maxKeywords ?? 10
  const maxAuthors = context?.limits.maxAuthors ?? 5
  const maxPdfSizeMb = context?.limits.maxPdfSizeMb ?? 50
  const maxDocumentSizeMb = context?.limits.maxDocumentSizeMb ?? 20

  const courseOptions = (context?.courses ?? []).map((course) => ({
    value: course.id,
    label: `${course.name} (${course.code})`,
  }))
  const advisorOptions = (context?.advisors ?? []).map((advisor) => ({
    value: advisor.id,
    label: advisor.name,
  }))

  const metadataPayload = (): ThesisMetadataInput => ({
    title: form.title.trim(),
    abstract: form.abstract.trim(),
    courseId: form.courseId,
    advisorId: form.advisorId,
    keywords: parseKeywords(form.keywords),
    authors: form.authors.map((author) => author.id),
  })

  const persistMetadata = async (advanceTo?: number): Promise<boolean> => {
    if (savingRef.current) return false
    savingRef.current = true
    try {
      return await persistMetadataInner(advanceTo)
    } finally {
      savingRef.current = false
    }
  }

  const persistMetadataInner = async (advanceTo?: number): Promise<boolean> => {
    const payload = metadataPayload()
    if (!payload.title) {
      setError("Informe o título da monografia.")
      return false
    }
    if (!payload.abstract) {
      setError("Informe o resumo da monografia.")
      return false
    }
    if (!payload.courseId) {
      setError("Selecione o curso da monografia.")
      return false
    }
    if (!payload.advisorId) {
      setError("Selecione o orientador da monografia.")
      return false
    }
    if (payload.keywords.length === 0) {
      setError("Informe pelo menos uma palavra-chave.")
      return false
    }
    if (payload.keywords.length > maxKeywords) {
      setError(`Informe no máximo ${maxKeywords} palavras-chave.`)
      return false
    }
    if ((payload.authors?.length ?? 0) >= maxAuthors) {
      setError(`O grupo pode ter no máximo ${maxAuthors} alunos, incluindo você.`)
      return false
    }
    setSaving(true)
    setError("")
    try {
      const response = await thesesApi.saveMetadata(payload)
      applyThesis(response.thesis)
      setNotice("Dados da monografia salvos.")
      if (advanceTo) setStep(advanceTo)
      return true
    } catch (reason) {
      setError(apiErrorMessage(reason))
      return false
    } finally {
      setSaving(false)
    }
  }

  const goToStep = async (nextStep: number) => {
    setNotice("")
    setError("")
    if (nextStep === 2 && !thesis) {
      const saved = await persistMetadata(2)
      if (!saved) return
      return
    }
    setStep(nextStep)
  }

  const handleFileSelection = async (file: File | null) => {
    setUploadError("")
    if (!file) return
    const problem = await validatePdfFile(file, maxPdfSizeMb)
    if (problem) {
      setSelectedFile(null)
      setUploadError(problem)
      return
    }
    setSelectedFile(file)
  }

  const chooseFile = () => {
    if (canEdit && !uploading) fileInputRef.current?.click()
  }

  const dropFile = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (!canEdit || uploading) return
    const droppedFiles = event.dataTransfer.files
    if (droppedFiles.length > 1) {
      setUploadError("Envie um único arquivo PDF por vez.")
      return
    }
    void handleFileSelection(droppedFiles[0] ?? null)
  }

  const uploadSelectedFile = async () => {
    if (!selectedFile) {
      setUploadError("Selecione um arquivo PDF.")
      return
    }
    setUploading(true)
    setUploadError("")
    setNotice("")
    const wasCorrection =
      thesis?.status === "CHANGES_REQUESTED" || thesis?.status === "REJECTED"
    try {
      const response = await thesesApi.uploadFile(selectedFile, changeDescription.trim())
      let nextThesis = response.thesis
      let noticeMessage = `Versão ${response.file.versionNumber} enviada e verificada por SHA-256.`
      if (wasCorrection && nextThesis.permissions.canSubmit) {
        try {
          const submitted = await thesesApi.submit()
          nextThesis = submitted.thesis
          noticeMessage = `Versão ${response.file.versionNumber} enviada ao orientador para nova análise.`
        } catch (submitReason) {
          applyThesis(nextThesis)
          setSelectedFile(null)
          setChangeDescription("")
          if (fileInputRef.current) fileInputRef.current.value = ""
          setStep(3)
          setError(
            `A versão ${response.file.versionNumber} foi enviada, mas não foi possível submetê-la automaticamente: ${apiErrorMessage(submitReason)}. Use "Enviar para o orientador".`,
          )
          return
        }
      } else if (nextThesis.permissions.canSubmit) {
        noticeMessage = `Versão ${response.file.versionNumber} enviada e verificada. Envie para o orientador para iniciar a análise.`
      }
      applyThesis(nextThesis)
      setSelectedFile(null)
      setChangeDescription("")
      if (fileInputRef.current) fileInputRef.current.value = ""
      setNotice(noticeMessage)
      setStep(3)
    } catch (reason) {
      setUploadError(apiErrorMessage(reason))
    } finally {
      setUploading(false)
    }
  }

  const submitThesis = async () => {
    setSubmitting(true)
    setError("")
    setNotice("")
    try {
      const response = await thesesApi.submit()
      applyThesis(response.thesis)
      setNotice("Monografia enviada ao orientador. Acompanhe o parecer nesta página.")
      setStep(3)
    } catch (reason) {
      setError(apiErrorMessage(reason))
    } finally {
      setSubmitting(false)
    }
  }

  const withdrawSubmission = async () => {
    if (
      !window.confirm(
        "Descartar o envio atual? A monografia voltará para edição e o orientador não poderá avaliá-la até um novo envio.",
      )
    ) {
      return
    }
    setWithdrawing(true)
    setError("")
    setNotice("")
    try {
      const response = await thesesApi.withdrawSubmission()
      applyThesis(response.thesis)
      setNotice(
        "Envio descartado. Você pode ajustar a monografia e enviá-la novamente quando estiver pronto.",
      )
      setStep(3)
    } catch (reason) {
      setError(apiErrorMessage(reason))
    } finally {
      setWithdrawing(false)
    }
  }

  const refreshThesis = async (id: string) => {
    const response = await thesesApi.detail(id)
    applyThesis(response.thesis)
  }

  const chooseDocument = async (file: File | null) => {
    setDocumentError("")
    if (!file) return
    const problem = await validatePdfFile(file, maxDocumentSizeMb)
    if (problem) {
      setDocumentFile(null)
      setDocumentError(problem)
      return
    }
    setDocumentFile(file)
  }

  const uploadDocument = async () => {
    if (!thesis) return
    if (!documentFile) {
      setDocumentError("Selecione um arquivo PDF.")
      return
    }
    setDocumentUploading(true)
    setDocumentError("")
    setNotice("")
    try {
      await thesesApi.uploadDocument(thesis.id, documentType, documentFile)
      setDocumentFile(null)
      if (documentInputRef.current) documentInputRef.current.value = ""
      await refreshThesis(thesis.id)
      setNotice("Documento complementar enviado.")
    } catch (reason) {
      setDocumentError(apiErrorMessage(reason))
    } finally {
      setDocumentUploading(false)
    }
  }

  const downloadFile = async (file: ThesisFile) => {
    try {
      const filename = file.storedFile.originalFilename || `monografia-v${file.versionNumber}.pdf`
      await thesesApi.downloadFile(file.downloadUrl, filename)
    } catch (reason) {
      setError(apiErrorMessage(reason))
    }
  }

  const downloadDocument = async (path: string, filename: string) => {
    try {
      await thesesApi.downloadFile(path, filename)
    } catch (reason) {
      setError(apiErrorMessage(reason))
    }
  }

  if (loading) {
    return (
      <div className="page-content">
        <PageTitle eyebrow="Minha monografia" title="Submissão de monografia" />
        <Card>
          <div className="pdf-feedback">
            <div className="upload-icon">
              <Icon name="file" />
            </div>
            <strong>Carregando sua monografia…</strong>
            <span>Buscando dados, versões e pareceres.</span>
          </div>
        </Card>
      </div>
    )
  }

  if (!context) {
    return (
      <div className="page-content">
        <PageTitle eyebrow="Minha monografia" title="Submissão de monografia" />
        <Card>
          <div className="empty-state">
            <div>
              <Icon name="alert" />
            </div>
            <h2>Não foi possível carregar a monografia</h2>
            <p>{error || "Tente novamente em instantes."}</p>
            <Button onClick={() => void load()}>Recarregar</Button>
          </div>
        </Card>
      </div>
    )
  }

  const statusBadge = thesis ? (
    <Badge tone={thesisStatusTone(thesis.status)}>{thesis.statusLabel}</Badge>
  ) : (
    <Badge tone="neutral">Rascunho</Badge>
  )

  return (
    <div className="page-content">
      <PageTitle
        eyebrow="Minha monografia"
        title="Submissão de monografia"
        action={statusBadge}
      />

      {notice && (
        <div className="success-notice" role="status">
          <Icon name="check" size={16} />
          <span>{notice}</span>
          <button type="button" className="icon-btn" aria-label="Fechar aviso" onClick={() => setNotice("")}>
            <Icon name="close" size={15} />
          </button>
        </div>
      )}
      {error && (
        <div className="form-error" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
          <button type="button" className="icon-btn" aria-label="Fechar erro" onClick={() => setError("")}>
            <Icon name="close" size={15} />
          </button>
        </div>
      )}

      <div className="stepper">
        {[
          ["Metadados", "Dados acadêmicos"],
          ["PDF e integridade", "Arquivo principal"],
          ["Acompanhamento", "Status e documentos"],
        ].map((item, index) => (
          <button
            type="button"
            className={step === index + 1 ? "active" : step > index + 1 ? "complete" : ""}
            onClick={() => void goToStep(index + 1)}
            key={item[0]}
          >
            <span>{step > index + 1 ? <Icon name="check" size={13} /> : index + 1}</span>
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
            {statusBadge}
          </div>
          {!canEdit && (
            <div className="inline-alert">
              <Icon name="lock" />
              <span>
                Esta monografia está em análise. Os dados ficam disponíveis para consulta, mas só podem ser
                alterados quando o orientador solicitar ajustes.
              </span>
            </div>
          )}
          {latestReview && latestReview.decision !== "APPROVED" && (
            <div className="inline-alert">
              <Icon name="alert" />
              <span>
                <strong>{latestReview.decisionLabel}:</strong> {latestReview.comments}
              </span>
            </div>
          )}
          <Field
            label="Título da monografia"
            placeholder="Informe o título completo do trabalho"
            value={form.title}
            onChange={(value) => setForm((current) => ({ ...current, title: value }))}
            disabled={!canEdit}
            required
          />
          <div className="two-col">
            <SelectField
              label="Curso"
              options={courseOptions}
              placeholder="Selecione o curso"
              value={form.courseId}
              onChange={(value) => setForm((current) => ({ ...current, courseId: value }))}
              disabled={!canEdit}
              required
            />
            <SelectField
              label="Orientador"
              options={advisorOptions}
              placeholder="Selecione o orientador"
              value={form.advisorId}
              onChange={(value) => setForm((current) => ({ ...current, advisorId: value }))}
              disabled={!canEdit}
              required
            />
          </div>
          <CoauthorPicker
            value={form.authors}
            onChange={(authors) => setForm((current) => ({ ...current, authors }))}
            maxAuthors={maxAuthors}
            disabled={!canEdit}
          />
          <Field
            label="Palavras-chave"
            placeholder="Cidades inteligentes, Sustentabilidade, IoT"
            hint={`Separe os termos com vírgulas · máximo de ${maxKeywords} palavras-chave`}
            value={form.keywords}
            onChange={(value) => setForm((current) => ({ ...current, keywords: value }))}
            disabled={!canEdit}
          />
          <label className="field">
            <span>Resumo</span>
            <textarea
              placeholder="Apresente o problema, os objetivos, a metodologia e os principais resultados esperados."
              value={form.abstract}
              onChange={(event) => setForm((current) => ({ ...current, abstract: event.target.value }))}
              disabled={!canEdit}
            />
            <small className="counter">{form.abstract.length} caracteres</small>
          </label>
          <div className="form-actions">
            {canEdit ? (
              <>
                <Button variant="secondary" disabled={saving} onClick={() => void persistMetadata()}>
                  {saving ? "Salvando…" : "Salvar rascunho"}
                </Button>
                <Button disabled={saving} onClick={() => void persistMetadata(2)}>
                  Continuar
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setStep(2)}>
                  Ver arquivo
                </Button>
                <Button onClick={() => setStep(3)}>Acompanhar</Button>
              </>
            )}
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
            {currentFile ? <Badge tone="success">Arquivo validado</Badge> : <Badge tone="neutral">Pendente</Badge>}
          </div>
          {!thesis ? (
            <div className="empty-state">
              <div>
                <Icon name="file" />
              </div>
              <h2>Salve os metadados primeiro</h2>
              <p>O arquivo PDF é vinculado ao rascunho da monografia.</p>
              <Button onClick={() => setStep(1)}>Voltar aos metadados</Button>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={(event) => {
                  const chosen = event.target.files?.[0] ?? null
                  // Zera o campo para permitir escolher de novo o mesmo arquivo depois de um erro.
                  event.target.value = ""
                  void handleFileSelection(chosen)
                }}
              />
              {currentFile ? (
                <div className="upload-zone done">
                  <div className="file-done">
                    <div className="upload-icon">
                      <Icon name="file" />
                    </div>
                    <div>
                      <strong>{currentFile.storedFile.originalFilename}</strong>
                      <span>
                        v{currentFile.versionNumber} · {formatBytes(currentFile.storedFile.sizeBytes)} · PDF
                      </span>
                    </div>
                    <Badge tone="success">
                      <Icon name="check" size={12} /> Integridade validada
                    </Badge>
                  </div>
                  <div className="integrity-grid">
                    <div>
                      <span>Hash SHA-256</span>
                      <code title={currentFile.storedFile.sha256}>{shortHash(currentFile.storedFile.sha256)}</code>
                    </div>
                    <div>
                      <span>Verificação</span>
                      <Badge tone="light">{currentFile.hashVerifiedAt ? "Integridade validada" : "Pendente"}</Badge>
                    </div>
                    <div>
                      <span>Processamento</span>
                      <strong>{currentFile.storedFile.processingStatus}</strong>
                    </div>
                  </div>
                  <div className="form-actions">
                    {canEdit && (
                      <Button variant="outline" disabled={uploading} onClick={chooseFile}>
                        Substituir arquivo
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => void downloadFile(currentFile)}>
                      Baixar PDF
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={`upload-zone${dragging ? " dragging" : ""}`}
                  onClick={chooseFile}
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (canEdit && !uploading) setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={dropFile}
                >
                  <div className="upload-icon">
                    <Icon name="upload" />
                  </div>
                  <strong>{dragging ? "Solte o PDF aqui" : "Arraste o PDF da monografia até aqui"}</strong>
                  <span>ou use o botão abaixo · somente PDF · máximo {maxPdfSizeMb} MB</span>
                  {/* O clique no botão sobe até a área, que abre o seletor uma única vez. */}
                  <Button variant="outline" disabled={!canEdit || uploading} describedBy="upload-limits">
                    Selecionar arquivo
                  </Button>
                  <span id="upload-limits" className="sr-only">
                    Somente arquivos PDF, com no máximo {maxPdfSizeMb} megabytes.
                  </span>
                </div>
              )}
              {selectedFile && (
                <div className="selected-file">
                  <div>
                    <Icon name="file" />
                    <span>
                      <strong>{selectedFile.name}</strong>
                      <small>
                        {formatBytes(selectedFile.size)} ·{" "}
                        {isCorrectionResubmission
                          ? "será enviada ao orientador ao continuar"
                          : "pronto para envio ao continuar"}
                      </small>
                    </span>
                  </div>
                  <div className="selected-file-actions">
                    <Button variant="ghost" disabled={uploading} onClick={() => setSelectedFile(null)}>
                      Remover
                    </Button>
                  </div>
                </div>
              )}
              {canEdit && (
                <Field
                  label="Descrição da alteração (opcional)"
                  placeholder="Ex.: ajustes solicitados pelo orientador"
                  value={changeDescription}
                  onChange={setChangeDescription}
                  hint="Ajuda o orientador a identificar o que mudou nesta versão."
                />
              )}
              <p className="sr-only" role="status" aria-live="polite">
                {uploading ? "Enviando o arquivo e verificando a integridade. Aguarde." : ""}
              </p>
              {uploadError && (
                <div className="form-error" role="alert">
                  <Icon name="alert" size={16} />
                  <span>{uploadError}</span>
                </div>
              )}
            </>
          )}
          <div className="form-actions">
            <Button variant="secondary" disabled={uploading} onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button
              disabled={!thesis || uploading}
              onClick={() => {
                if (selectedFile && canEdit) {
                  void uploadSelectedFile()
                  return
                }
                setStep(3)
              }}
            >
              {uploading
                ? "Enviando…"
                : selectedFile && canEdit && isCorrectionResubmission
                  ? "Enviar ao orientador"
                  : selectedFile && canEdit
                    ? "Enviar e continuar"
                    : "Continuar"}
            </Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <>
          {!thesis ? (
            <div className="empty-state">
              <div>
                <Icon name="file" />
              </div>
              <h2>Nenhuma monografia cadastrada</h2>
              <p>Preencha os dados acadêmicos e envie o PDF para iniciar o acompanhamento.</p>
              <Button onClick={() => setStep(1)}>Iniciar submissão</Button>
            </div>
          ) : (
            <div className="tracking-layout">
              <div className="stack">
                <Card>
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Acompanhamento</p>
                      <h2>{thesis.title}</h2>
                    </div>
                    {statusBadge}
                  </div>
                  <p>{thesis.statusDescription}</p>
                  <dl className="meta-list">
                    <div>
                      <dt>Referência</dt>
                      <dd>{thesis.referenceCode}</dd>
                    </div>
                    <div>
                      <dt>Curso</dt>
                      <dd>{thesis.course.name}</dd>
                    </div>
                    <div>
                      <dt>Orientador</dt>
                      <dd>{thesis.advisor.name}</dd>
                    </div>
                    <div>
                      <dt>Autores</dt>
                      <dd>{thesis.authors.map((author) => author.name ?? author.user?.name).join(", ")}</dd>
                    </div>
                    <div>
                      <dt>Palavras-chave</dt>
                      <dd>
                        {thesis.keywords.map((keyword) => (
                          <Badge tone="light" key={keyword}>
                            {keyword}
                          </Badge>
                        ))}
                      </dd>
                    </div>
                  </dl>
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
                  {latestReview && (
                    <div className="review-summary">
                      <div className="section-head">
                        <div>
                          <p className="eyebrow">Último parecer</p>
                          <h3>{latestReview.decisionLabel}</h3>
                        </div>
                        <Badge tone={latestReview.decision === "APPROVED" ? "success" : latestReview.decision === "REJECTED" ? "dark" : "light"}>
                          {latestReview.decisionLabel}
                        </Badge>
                      </div>
                      <p>{latestReview.comments || "Sem comentários adicionais."}</p>
                      {latestReview.recommendations && (
                        <div className="inline-alert">
                          <Icon name="alert" />
                          <span>
                            <strong>Recomendações:</strong> {latestReview.recommendations}
                          </span>
                        </div>
                      )}
                      <small>
                        {latestReview.reviewer?.name ?? "Orientador"} · {formatDateTime(latestReview.reviewedAt)}
                      </small>
                    </div>
                  )}
                  {canSubmit && (thesis.status === "CHANGES_REQUESTED" || thesis.status === "REJECTED") && (
                    <div className="inline-alert" role="status">
                      <Icon name="upload" />
                      <span>
                        <strong>Envio pendente.</strong> Você já pode enviar esta versão para análise do orientador.
                        O orientador só consegue revisar após o envio.
                      </span>
                    </div>
                  )}
                  {canWithdrawSubmission && (
                    <div className="inline-alert" role="status">
                      <Icon name="clock" />
                      <span>
                        <strong>Envio aguardando avaliação.</strong> Enquanto o orientador não registrar
                        um parecer, você pode descartar este envio para fazer ajustes.
                      </span>
                    </div>
                  )}
                  <div className="form-actions">
                    {canEdit && (
                      <>
                        <Button variant="secondary" onClick={() => setStep(1)}>
                          Editar metadados
                        </Button>
                        <Button variant="outline" onClick={() => setStep(2)}>
                          {thesis.status === "DRAFT" ? "Enviar arquivo" : "Enviar nova versão"}
                        </Button>
                      </>
                    )}
                    {canWithdrawSubmission && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={withdrawing || submitting}
                        onClick={() => void withdrawSubmission()}
                      >
                        {withdrawing ? "Descartando…" : "Descartar último envio"}
                      </button>
                    )}
                    {canSubmit && (
                      <Button variant="success" icon="upload" disabled={submitting || withdrawing} onClick={() => void submitThesis()}>
                        {submitting ? "Enviando…" : "Enviar para o orientador"}
                      </Button>
                    )}
                  </div>
                </Card>

                <Card>
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Histórico</p>
                      <h3>Linha do tempo</h3>
                    </div>
                  </div>
                  <div className="timeline">
                    {(thesis.statusHistory ?? []).map((entry, index) => (
                      <div className={index === 0 ? "current" : ""} key={entry.id}>
                        <span>{index === 0 ? <Icon name="check" size={12} /> : index + 1}</span>
                        <div>
                          <strong>{entry.newStatusLabel}</strong>
                          <small>
                            {formatDateTime(entry.changedAt)}
                            {entry.changedBy ? ` · ${entry.changedBy.name}` : ""}
                          </small>
                          {entry.reason && <small>{entry.reason}</small>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div className="stack">
                <Card>
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Arquivo principal</p>
                      <h3>{activeFile ? `Versão ${activeFile.versionNumber}` : "Nenhum PDF enviado"}</h3>
                    </div>
                    {activeFile && (
                      <Badge tone={activeFile.isCurrent ? "success" : "neutral"}>
                        {activeFile.isCurrent ? "Atual" : `v${activeFile.versionNumber}`}
                      </Badge>
                    )}
                  </div>
                  {activeFile ? (
                    <PdfViewer
                      src={activeFile.previewUrl}
                      filename={activeFile.storedFile.originalFilename}
                      downloadPath={activeFile.downloadUrl}
                      height={520}
                    />
                  ) : (
                    <div className="empty-state compact">
                      <div>
                        <Icon name="file" />
                      </div>
                      <h3>Envie o PDF da monografia</h3>
                      <p>Somente arquivos PDF são aceitos.</p>
                      {canEdit && <Button onClick={() => setStep(2)}>Enviar PDF</Button>}
                    </div>
                  )}
                </Card>

                <Card className="version-drawer">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Arquivos</p>
                      <h3>Histórico de versões</h3>
                    </div>
                    <Badge tone="light">{files.length} versão(ões)</Badge>
                  </div>
                  {files.length === 0 && <p>Nenhuma versão enviada.</p>}
                  {files.map((file) => (
                    <div className="version" key={file.id}>
                      <div>
                        <Badge tone={file.isCurrent ? "active" : "neutral"}>
                          v{file.versionNumber}
                          {file.isCurrent ? " · Atual" : ""}
                        </Badge>
                        <strong>{formatDateTime(file.uploadedAt)}</strong>
                        <span>{formatBytes(file.storedFile.sizeBytes)}</span>
                      </div>
                      <div className="version-actions">
                        <Button variant="ghost" onClick={() => setActiveFileId(file.id)}>
                          Visualizar
                        </Button>
                        <Button variant="ghost" icon="download" onClick={() => void downloadFile(file)}>
                          Baixar
                        </Button>
                      </div>
                    </div>
                  ))}
                  {files.length > 1 && (
                    <div className="inline-alert">
                      <Icon name="alert" />
                      <span>
                        O histórico completo é mantido durante a orientação. Após a aprovação final da banca,
                        apenas a versão corrigida permanece disponível.
                      </span>
                    </div>
                  )}
                </Card>

                <Card>
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Documentação</p>
                      <h3>Documentos complementares</h3>
                    </div>
                  </div>
                  {(thesis.documents ?? []).length === 0 && (
                    <p>Nenhum documento complementar enviado.</p>
                  )}
                  {(thesis.documents ?? []).map((document) => (
                    <div className="document-row" key={document.id}>
                      <div>
                        <Icon name="file" />
                        <span>
                          <strong>{document.typeLabel}</strong>
                          <small>
                            {formatDateTime(document.submittedAt)} · {formatBytes(document.storedFile.sizeBytes)}
                          </small>
                        </span>
                      </div>
                      <Badge tone={documentStatusTones[document.status]}>
                        {documentStatusLabels[document.status]}
                      </Badge>
                      <Button
                        variant="outline"
                        icon="download"
                        onClick={() =>
                          void downloadDocument(document.downloadUrl, document.storedFile.originalFilename)
                        }
                      >
                        Baixar
                      </Button>
                    </div>
                  ))}
                  {canUploadDocuments && (
                    <div className="document-upload">
                      <input
                        ref={documentInputRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        hidden
                        onChange={(event) => {
                          const chosen = event.target.files?.[0] ?? null
                          event.target.value = ""
                          void chooseDocument(chosen)
                        }}
                      />
                      <SelectField
                        label="Tipo de documento"
                        options={documentTypeOptions}
                        value={documentType}
                        onChange={(value) => setDocumentType(value as ThesisDocumentType)}
                      />
                      <div className="selected-file compact">
                        <div>
                          <Icon name="file" />
                          <span>
                            <strong>{documentFile ? documentFile.name : "Nenhum arquivo selecionado"}</strong>
                            <small>PDF · máximo {maxDocumentSizeMb} MB</small>
                          </span>
                        </div>
                        <div className="selected-file-actions">
                          <Button variant="outline" onClick={() => documentInputRef.current?.click()}>
                            Selecionar
                          </Button>
                          <Button
                            variant="success"
                            disabled={!documentFile || documentUploading}
                            onClick={() => void uploadDocument()}
                          >
                            {documentUploading ? "Enviando…" : "Enviar"}
                          </Button>
                        </div>
                      </div>
                      {documentError && (
                        <div className="form-error" role="alert">
                          <Icon name="alert" size={16} />
                          <span>{documentError}</span>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
