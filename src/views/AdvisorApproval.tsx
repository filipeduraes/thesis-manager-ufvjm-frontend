import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  thesesApi,
  type Thesis,
  type ThesisDefenseResult,
  type ThesisDocument,
  type ThesisDocumentType,
  type ThesisFile,
  type ThesisListItem,
  type ThesisReviewDecision,
} from "../api/client"
import {
  Badge,
  Breadcrumb,
  Button,
  Card,
  Field,
  Icon,
  Modal,
  PageTitle,
  Pagination,
  PdfViewer,
  SelectField,
} from "../components/common"
import {
  defenseResultLabels,
  documentStatusLabels,
  documentStatusTones,
  documentTypeOptions,
  formatBytes,
  formatDateTime,
  reviewDecisionTones,
  shortHash,
  thesisStatusOptions,
  thesisStatusTone,
} from "../data/thesisStatus"
import type { Profile } from "../types"

interface AdvisorApprovalProps {
  initialThesisId?: string
  profile?: Profile
}

type ActionKey =
  | ThesisReviewDecision
  | "DEFENSE"
  | "PUBLISH"
  | "DOCUMENT"

const defenseResultOptions = (Object.keys(defenseResultLabels) as ThesisDefenseResult[]).map((value) => ({
  value,
  label: defenseResultLabels[value],
}))

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Não foi possível concluir a solicitação."
}

export default function AdvisorApproval({ initialThesisId, profile = "Orientador" }: AdvisorApprovalProps) {
  const [items, setItems] = useState<ThesisListItem[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [count, setCount] = useState(0)
  const [searchInput, setSearchInput] = useState("")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [pendingOnly, setPendingOnly] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState("")
  const [selectedId, setSelectedId] = useState<string | undefined>(initialThesisId)
  const [detail, setDetail] = useState<Thesis | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState("")
  const [activeFileId, setActiveFileId] = useState<string | null>(null)
  const [comments, setComments] = useState("")
  const [recommendations, setRecommendations] = useState("")
  const [actionLoading, setActionLoading] = useState<ActionKey | null>(null)
  const [actionError, setActionError] = useState("")
  const [notice, setNotice] = useState("")
  const [confirm, setConfirm] = useState<"approve" | "reject" | "publish" | null>(null)
  const [defenseResult, setDefenseResult] = useState<ThesisDefenseResult>("APPROVED")
  const [defenseReason, setDefenseReason] = useState("")
  const [documentType, setDocumentType] = useState<ThesisDocumentType>("DEFENSE_MINUTES")
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [documentUploading, setDocumentUploading] = useState(false)
  const [documentError, setDocumentError] = useState("")
  const [validatingDocumentId, setValidatingDocumentId] = useState<string | null>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)

  const scope = profile === "Orientador" ? "advised" : undefined
  const pageLabel = profile === "Orientador" ? "Orientandos" : "Monografias"
  const eyebrow = profile === "Orientador" ? "Orientação acadêmica" : "Gestão acadêmica"

  const listRequestRef = useRef(0)
  const detailRequestRef = useRef(0)

  const loadList = useCallback(async () => {
    const requestId = ++listRequestRef.current
    setListLoading(true)
    setListError("")
    try {
      const data = await thesesApi.list({
        scope,
        q: query,
        status: statusFilter,
        pendingReview: pendingOnly || undefined,
        page,
        pageSize: 10,
      })
      if (requestId !== listRequestRef.current) return
      setItems(data.results)
      setTotalPages(data.totalPages)
      setCount(data.count)
    } catch (reason) {
      if (requestId !== listRequestRef.current) return
      setListError(errorMessage(reason))
    } finally {
      if (requestId === listRequestRef.current) setListLoading(false)
    }
  }, [page, pendingOnly, query, scope, statusFilter])

  useEffect(() => {
    void loadList()
    return () => {
      listRequestRef.current += 1
    }
  }, [loadList])

  const loadDetail = useCallback(async (id: string) => {
    const requestId = ++detailRequestRef.current
    setDetailLoading(true)
    setDetailError("")
    setActionError("")
    setNotice("")
    try {
      const response = await thesesApi.detail(id)
      if (requestId !== detailRequestRef.current) return
      setDetail(response.thesis)
      setActiveFileId(response.thesis.currentFile?.id ?? null)
      setComments("")
      setRecommendations("")
      setDefenseResult("APPROVED")
      setDefenseReason("")
      setDocumentFile(null)
      setDocumentError("")
    } catch (reason) {
      if (requestId !== detailRequestRef.current) return
      setDetail(null)
      setDetailError(errorMessage(reason))
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId)
    } else {
      detailRequestRef.current += 1
      setDetail(null)
    }
    return () => {
      detailRequestRef.current += 1
    }
  }, [loadDetail, selectedId])

  useEffect(() => {
    if (initialThesisId) setSelectedId(initialThesisId)
  }, [initialThesisId])

  const currentFile = detail?.currentFile ?? null
  const files = useMemo(() => detail?.files ?? [], [detail])
  const activeFile = useMemo(
    () => files.find((item) => item.id === activeFileId) ?? currentFile ?? files[0] ?? null,
    [activeFileId, currentFile, files],
  )

  const applyFilters = () => {
    setPage(1)
    setQuery(searchInput.trim())
  }

  const openDetail = (id: string) => {
    setSelectedId(id)
  }

  const closeDetail = () => {
    setSelectedId(undefined)
    setDetail(null)
    setDetailError("")
    setActionError("")
    setNotice("")
    void loadList()
  }

  const submitReview = async (decision: ThesisReviewDecision) => {
    if (!detail) return
    if ((decision === "CHANGES_REQUESTED" || decision === "REJECTED") && !comments.trim()) {
      setActionError("Descreva os ajustes ou o motivo da reprovação antes de registrar o parecer.")
      setConfirm(null)
      return
    }
    setActionLoading(decision)
    setActionError("")
    setNotice("")
    try {
      const response = await thesesApi.review(detail.id, {
        decision,
        comments: comments.trim(),
        recommendations: recommendations.trim(),
      })
      setDetail(response.thesis)
      setActiveFileId(response.thesis.currentFile?.id ?? null)
      setComments("")
      setRecommendations("")
      setConfirm(null)
      setNotice(
        decision === "APPROVED"
          ? "Parecer de aprovação registrado. A coordenação já pode agendar a banca."
          : decision === "CHANGES_REQUESTED"
            ? "Ajustes solicitados ao aluno."
            : "Submissão reprovada. O aluno deverá enviar uma nova versão.",
      )
      await loadList()
    } catch (reason) {
      setActionError(errorMessage(reason))
      setConfirm(null)
    } finally {
      setActionLoading(null)
    }
  }

  const recordDefenseResult = async () => {
    if (!detail) return
    setActionLoading("DEFENSE")
    setActionError("")
    setNotice("")
    try {
      const response = await thesesApi.recordDefenseResult(detail.id, {
        result: defenseResult,
        reason: defenseReason.trim(),
      })
      setDetail(response.thesis)
      setActiveFileId(response.thesis.currentFile?.id ?? null)
      setDefenseReason("")
      setNotice("Resultado da banca registrado.")
      await loadList()
    } catch (reason) {
      setActionError(errorMessage(reason))
    } finally {
      setActionLoading(null)
    }
  }

  const publishThesis = async () => {
    if (!detail) return
    setActionLoading("PUBLISH")
    setActionError("")
    setNotice("")
    try {
      const response = await thesesApi.publish(detail.id)
      setDetail(response.thesis)
      setActiveFileId(response.thesis.currentFile?.id ?? null)
      setConfirm(null)
      setNotice("Monografia publicada no repositório institucional.")
      await loadList()
    } catch (reason) {
      setActionError(errorMessage(reason))
      setConfirm(null)
    } finally {
      setActionLoading(null)
    }
  }

  const uploadDocument = async () => {
    if (!detail) return
    if (!documentFile) {
      setDocumentError("Selecione um arquivo PDF.")
      return
    }
    setDocumentUploading(true)
    setDocumentError("")
    setNotice("")
    try {
      await thesesApi.uploadDocument(detail.id, documentType, documentFile)
      setDocumentFile(null)
      if (documentInputRef.current) documentInputRef.current.value = ""
      const response = await thesesApi.detail(detail.id)
      setDetail(response.thesis)
      setNotice("Documento complementar enviado.")
    } catch (reason) {
      setDocumentError(errorMessage(reason))
    } finally {
      setDocumentUploading(false)
    }
  }

  const validateDocument = async (document: ThesisDocument) => {
    if (!detail) return
    setValidatingDocumentId(document.id)
    setActionError("")
    setNotice("")
    try {
      await thesesApi.validateDocument(detail.id, document.id)
      const response = await thesesApi.detail(detail.id)
      setDetail(response.thesis)
      setNotice(`${document.typeLabel} validado.`)
    } catch (reason) {
      setActionError(errorMessage(reason))
    } finally {
      setValidatingDocumentId(null)
    }
  }

  const downloadFile = async (file: ThesisFile) => {
    try {
      const filename = file.storedFile.originalFilename || `monografia-v${file.versionNumber}.pdf`
      await thesesApi.downloadFile(file.downloadUrl, filename)
    } catch (reason) {
      setActionError(errorMessage(reason))
    }
  }

  const downloadDocument = async (document: ThesisDocument) => {
    try {
      await thesesApi.downloadFile(document.downloadUrl, document.storedFile.originalFilename)
    } catch (reason) {
      setActionError(errorMessage(reason))
    }
  }

  if (selectedId) {
    return (
      <div className="page-content">
        <Breadcrumb
          items={[{ label: pageLabel, onClick: closeDetail }, { label: "Detalhe da submissão" }]}
          action={
            detail && !detailLoading ? (
              <Button
                variant="secondary"
                className="breadcrumb-action"
                onClick={() => void loadDetail(detail.id)}
              >
                Atualizar
              </Button>
            ) : undefined
          }
        />
        {detailLoading && (
          <Card>
            <div className="pdf-feedback">
              <div className="upload-icon">
                <Icon name="file" />
              </div>
              <strong>Carregando submissão…</strong>
              <span>Buscando versões, pareceres e documentos.</span>
            </div>
          </Card>
        )}
        {!detailLoading && detailError && (
          <Card>
            <div className="empty-state">
              <div>
                <Icon name="alert" />
              </div>
              <h2>Não foi possível abrir a submissão</h2>
              <p>{detailError}</p>
              <Button onClick={() => void loadDetail(selectedId)}>Tentar novamente</Button>
            </div>
          </Card>
        )}
        {!detailLoading && detail && (
          <>
            <PageTitle
              eyebrow={`Submissão ${detail.referenceCode}`}
              title={detail.title}
              subtitle={`${detail.student?.name ?? "Aluno"} · ${detail.course.name}`}
              action={<Badge tone={thesisStatusTone(detail.status)}>{detail.statusLabel}</Badge>}
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
            {actionError && (
              <div className="form-error" role="alert">
                <Icon name="alert" size={16} />
                <span>{actionError}</span>
                <button type="button" className="icon-btn" aria-label="Fechar erro" onClick={() => setActionError("")}>
                  <Icon name="close" size={15} />
                </button>
              </div>
            )}
            <div className="review-split">
              <div className="review-media">
                <Card>
                  {activeFile ? (
                    <PdfViewer
                      src={activeFile.previewUrl}
                      filename={activeFile.storedFile.originalFilename}
                      downloadPath={activeFile.downloadUrl}
                      className="review-pdf"
                      height={620}
                    />
                  ) : (
                    <div className="empty-state compact">
                      <div>
                        <Icon name="file" />
                      </div>
                      <h3>Nenhum PDF enviado</h3>
                      <p>O aluno ainda não anexou a versão da monografia.</p>
                    </div>
                  )}
                </Card>
                <Card className="version-drawer">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Arquivos</p>
                      <h3>Histórico de versões</h3>
                    </div>
                    {activeFile && <Badge tone="light">SHA-256 {shortHash(activeFile.storedFile.sha256)}</Badge>}
                  </div>
                  {files.length === 0 && <p>Nenhuma versão enviada.</p>}
                  {files.map((file) => (
                    <div className={`version ${file.id === activeFile?.id ? "selected" : ""}`} key={file.id}>
                      <div>
                        <Badge tone={file.isCurrent ? "active" : "neutral"}>
                          v{file.versionNumber}
                          {file.isCurrent ? " · Atual" : ""}
                        </Badge>
                        <strong>{formatDateTime(file.uploadedAt)}</strong>
                        <span>{formatBytes(file.storedFile.sizeBytes)}</span>
                        {file.changeDescription && <span>{file.changeDescription}</span>}
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
                </Card>
              </div>

              <aside className="review-decision">
                <Card>
                  <p className="eyebrow">Resumo do aluno</p>
                  <h3>{detail.student?.name ?? "Aluno"}</h3>
                  <dl className="meta-list">
                    <div>
                      <dt>Curso</dt>
                      <dd>{detail.course.name}</dd>
                    </div>
                    <div>
                      <dt>Orientador</dt>
                      <dd>{detail.advisor.name}</dd>
                    </div>
                    <div>
                      <dt>Enviada em</dt>
                      <dd>{formatDateTime(detail.submittedAt)}</dd>
                    </div>
                    <div>
                      <dt>Versão atual</dt>
                      <dd>{currentFile ? `v${currentFile.versionNumber}` : "—"}</dd>
                    </div>
                    <div>
                      <dt>Palavras-chave</dt>
                      <dd>
                        {detail.keywords.map((keyword) => (
                          <Badge tone="light" key={keyword}>
                            {keyword}
                          </Badge>
                        ))}
                      </dd>
                    </div>
                  </dl>
                  <div className="abstract-text">
                    <span>Resumo</span>
                    <p>{detail.abstract || "Resumo não informado."}</p>
                  </div>
                </Card>

                {detail.permissions.canReview && (
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
                        value={comments}
                        onChange={(event) => setComments(event.target.value)}
                      />
                    </label>
                    <label className="field">
                      <span>Recomendações adicionais (opcional)</span>
                      <textarea
                        className="feedback-area small"
                        placeholder="Orientações complementares para o aluno."
                        value={recommendations}
                        onChange={(event) => setRecommendations(event.target.value)}
                      />
                    </label>
                    <div className="inline-alert">
                      <Icon name="alert" />
                      <span>A aprovação libera o trabalho para agendamento da banca.</span>
                    </div>
                    <div className="button-stack">
                      <Button
                        variant="success"
                        icon="check"
                        disabled={actionLoading !== null}
                        onClick={() => setConfirm("approve")}
                      >
                        Aprovar para banca
                      </Button>
                      <Button
                        variant="outline"
                        disabled={actionLoading !== null}
                        onClick={() => void submitReview("CHANGES_REQUESTED")}
                      >
                        {actionLoading === "CHANGES_REQUESTED" ? "Registrando…" : "Solicitar ajustes"}
                      </Button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={actionLoading !== null}
                        onClick={() => setConfirm("reject")}
                      >
                        Reprovar submissão
                      </button>
                    </div>
                  </Card>
                )}

                {!detail.permissions.canReview && (
                  <Card>
                    <div className="section-head">
                      <div>
                        <p className="eyebrow">Parecer</p>
                        <h3>Situação da submissão</h3>
                      </div>
                    </div>
                    <div className="inline-alert">
                      <Icon name="clock" />
                      <span>
                        <strong>{detail.statusLabel}.</strong> {detail.statusDescription}
                        {" "}Apenas o orientador atribuído
                        {detail.advisor?.name ? ` (${detail.advisor.name})` : ""} com papel de orientador
                        pode registrar parecer quando o status for &quot;Submetida&quot;. Se o aluno acabou de
                        enviar uma nova versão, use &quot;Atualizar&quot;.
                      </span>
                    </div>
                  </Card>
                )}

                {(detail.permissions.canRecordDefenseResult || detail.permissions.canPublish) && (
                  <Card className="decision-card">
                    <div>
                      <p className="eyebrow">Gestão acadêmica</p>
                      <h2>Resultado e publicação</h2>
                    </div>
                    {detail.permissions.canRecordDefenseResult && (
                      <>
                        <SelectField
                          label="Resultado da banca"
                          options={defenseResultOptions}
                          value={defenseResult}
                          onChange={(value) => setDefenseResult(value as ThesisDefenseResult)}
                        />
                        <Field
                          label="Justificativa (opcional)"
                          placeholder="Registre observações sobre o resultado"
                          value={defenseReason}
                          onChange={setDefenseReason}
                        />
                        <Button
                          variant="primary"
                          disabled={actionLoading !== null}
                          onClick={() => void recordDefenseResult()}
                        >
                          {actionLoading === "DEFENSE" ? "Registrando…" : "Registrar resultado da banca"}
                        </Button>
                      </>
                    )}
                    {detail.permissions.canPublish && (
                      <>
                        <div className="inline-alert">
                          <Icon name="alert" />
                          <span>
                            A publicação exige autorização de publicação validada. Apenas a versão atual será
                            mantida no repositório.
                          </span>
                        </div>
                        <Button
                          variant="success"
                          icon="book"
                          disabled={actionLoading !== null}
                          onClick={() => setConfirm("publish")}
                        >
                          Publicar no repositório
                        </Button>
                      </>
                    )}
                  </Card>
                )}

                <Card>
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Pareceres</p>
                      <h3>Histórico de avaliações</h3>
                    </div>
                  </div>
                  {(detail.reviews ?? []).length === 0 && <p>Nenhum parecer registrado.</p>}
                  {(detail.reviews ?? []).map((review) => (
                    <div className="review-entry" key={review.id}>
                      <div className="section-head">
                        <div>
                          <strong>{review.decisionLabel}</strong>
                          <small>
                            {review.reviewer?.name ?? "Orientador"} · {formatDateTime(review.reviewedAt)}
                          </small>
                        </div>
                        <Badge tone={reviewDecisionTones[review.decision]}>{review.decisionLabel}</Badge>
                      </div>
                      {review.comments && <p>{review.comments}</p>}
                      {review.recommendations && <small>{review.recommendations}</small>}
                    </div>
                  ))}
                </Card>

                <Card>
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Documentação</p>
                      <h3>Documentos complementares</h3>
                    </div>
                  </div>
                  {(detail.documents ?? []).length === 0 && <p>Nenhum documento complementar enviado.</p>}
                  {(detail.documents ?? []).map((document) => (
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
                      <Badge tone={documentStatusTones[document.status]}>{documentStatusLabels[document.status]}</Badge>
                      <div className="document-actions">
                        <Button variant="ghost" icon="download" onClick={() => void downloadDocument(document)}>
                          Baixar
                        </Button>
                        {detail.permissions.canManage && document.status !== "VALIDATED" && (
                          <Button
                            variant="outline"
                            disabled={validatingDocumentId === document.id}
                            onClick={() => void validateDocument(document)}
                          >
                            {validatingDocumentId === document.id ? "Validando…" : "Validar"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {detail.permissions.canUploadDocuments && (
                    <div className="document-upload">
                      <input
                        ref={documentInputRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        hidden
                        onChange={(event) => {
                          setDocumentError("")
                          setDocumentFile(event.target.files?.[0] ?? null)
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
                            <small>PDF</small>
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
              </aside>
            </div>

            <Card className="status-history-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Histórico</p>
                  <h3>Linha do tempo da monografia</h3>
                </div>
              </div>
              <div className="timeline">
                {(detail.statusHistory ?? []).map((entry, index) => (
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

            {confirm === "approve" && (
              <Modal className="confirmation-modal">
                <div className="modal-icon">
                  <Icon name="check" />
                </div>
                <h2>Aprovar para banca?</h2>
                <p>
                  Ao confirmar, a coordenação poderá agendar a defesa e o aluno será notificado.
                </p>
                <div className="modal-actions">
                  <Button variant="secondary" onClick={() => setConfirm(null)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="success"
                    disabled={actionLoading !== null}
                    onClick={() => void submitReview("APPROVED")}
                  >
                    {actionLoading === "APPROVED" ? "Registrando…" : "Confirmar aprovação"}
                  </Button>
                </div>
              </Modal>
            )}
            {confirm === "reject" && (
              <Modal className="confirmation-modal">
                <div className="modal-icon danger">
                  <Icon name="alert" />
                </div>
                <h2>Reprovar submissão?</h2>
                <p>
                  O aluno será notificado e deverá enviar uma nova versão antes de prosseguir. Descreva o motivo
                  nos comentários do parecer.
                </p>
                <div className="modal-actions">
                  <Button variant="secondary" onClick={() => setConfirm(null)}>
                    Cancelar
                  </Button>
                  <button
                    type="button"
                    className="btn btn-danger-solid"
                    disabled={actionLoading !== null}
                    onClick={() => void submitReview("REJECTED")}
                  >
                    {actionLoading === "REJECTED" ? "Registrando…" : "Confirmar reprovação"}
                  </button>
                </div>
              </Modal>
            )}
            {confirm === "publish" && (
              <Modal className="confirmation-modal">
                <div className="modal-icon">
                  <Icon name="book" />
                </div>
                <h2>Publicar no repositório?</h2>
                <p>
                  A monografia ficará visível publicamente e as versões anteriores serão removidas, mantendo apenas
                  a versão atual.
                </p>
                <div className="modal-actions">
                  <Button variant="secondary" onClick={() => setConfirm(null)}>
                    Cancelar
                  </Button>
                  <Button variant="success" disabled={actionLoading !== null} onClick={() => void publishThesis()}>
                    {actionLoading === "PUBLISH" ? "Publicando…" : "Confirmar publicação"}
                  </Button>
                </div>
              </Modal>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="page-content">
      <PageTitle eyebrow={eyebrow} title="Acompanhamento e aprovação" />
      <Card>
        <div className="filterbar">
          <div className="top-search">
            <Icon name="search" />
            <input
              placeholder="Buscar aluno, título ou referência..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters()
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Status: Todos</option>
            {thesisStatusOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(event) => {
                setPendingOnly(event.target.checked)
                setPage(1)
              }}
            />
            <span>Somente aguardando parecer</span>
          </label>
          <Button variant="secondary" icon="filter" onClick={applyFilters}>
            Filtrar
          </Button>
        </div>
        <div className="results-head">
          <small>
            {count} monografia(s) encontrada(s)
            {query ? ` para “${query}”` : ""}
          </small>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setSearchInput("")
              setQuery("")
              setStatusFilter("")
              setPendingOnly(false)
              setPage(1)
            }}
          >
            Limpar filtros
          </button>
        </div>
        {listLoading && (
          <div className="pdf-feedback">
            <div className="upload-icon">
              <Icon name="users" />
            </div>
            <strong>Carregando monografias…</strong>
            <span>Aplicando escopo de permissões do seu perfil.</span>
          </div>
        )}
        {!listLoading && listError && (
          <div className="form-error" role="alert">
            <Icon name="alert" size={16} />
            <span>{listError}</span>
            <Button variant="secondary" onClick={() => void loadList()}>
              Tentar novamente
            </Button>
          </div>
        )}
        {!listLoading && !listError && items.length === 0 && (
          <div className="empty-state compact">
            <div>
              <Icon name="users" />
            </div>
            <h2>Nenhuma monografia encontrada</h2>
            <p>
              {pendingOnly
                ? "Não há submissões aguardando parecer neste momento."
                : "Ajuste os filtros ou aguarde novas submissões dos orientandos."}
            </p>
          </div>
        )}
        {!listLoading && !listError && items.length > 0 && (
          <div className="full-table">
            <div className="row head">
              <span>Aluno / Monografia</span>
              <span>Curso</span>
              <span>Envio</span>
              <span>Status</span>
              <span>Versão</span>
              <span />
            </div>
            {items.map((item) => (
              <button type="button" className="row" key={item.id} onClick={() => openDetail(item.id)}>
                <span>
                  <strong>{item.student?.name ?? "Aluno"}</strong>
                  <small>{item.title}</small>
                </span>
                <span>{item.course.name}</span>
                <span>{formatDateTime(item.submittedAt)}</span>
                <span>
                  <Badge tone={thesisStatusTone(item.status)}>{item.statusLabel}</Badge>
                </span>
                <span>{item.currentVersion ? `v${item.currentVersion}` : "—"}</span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        )}
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          disabled={listLoading}
        />
      </Card>
    </div>
  )
}
