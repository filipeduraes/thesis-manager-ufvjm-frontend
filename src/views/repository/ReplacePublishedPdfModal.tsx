import { useRef, useState } from "react"
import { repositoryApi, type Thesis } from "../../api/client"
import { Button, Field, Icon, Modal } from "../../components/common"
import { validatePdfFile } from "../../data/pdfFile"
import { formatBytes } from "../../data/thesisStatus"
import { REPOSITORY_MAX_PDF_SIZE_MB, repositoryErrorMessage } from "./repositoryForm"

interface ReplacePublishedPdfModalProps {
  thesis: Thesis
  onClose: () => void
  onReplaced: (thesis: Thesis) => void
}

/**
 * Publishes a new PDF of a published thesis as a new version
 * (`POST /theses/<id>/published/files`), after an explicit confirmation step.
 */
export default function ReplacePublishedPdfModal({ thesis, onClose, onReplaced }: ReplacePublishedPdfModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [description, setDescription] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const sendingRef = useRef(false)
  const currentVersion = thesis.currentFile?.versionNumber

  const chooseFile = async (chosen: File | null) => {
    setFile(null)
    setError("")
    if (!chosen) return
    const problem = await validatePdfFile(chosen, REPOSITORY_MAX_PDF_SIZE_MB)
    if (problem) setError(problem)
    else setFile(chosen)
  }

  const send = async () => {
    if (!file || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setError("")
    try {
      const response = await repositoryApi.replacePublishedFile(thesis.id, file, description.trim())
      onReplaced(response.thesis)
    } catch (reason) {
      setError(repositoryErrorMessage(reason, "Não foi possível enviar o novo PDF."))
      setConfirming(false)
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  return (
    <Modal className="admin-modal" onClose={sending ? undefined : onClose} labelledBy="replace-pdf-title">
      <div className="section-head">
        <h2 id="replace-pdf-title">{confirming ? "Confirmar substituição do PDF?" : "Substituir PDF publicado"}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar" disabled={sending}>
          <Icon name="close" />
        </button>
      </div>
      {confirming && file ? (
        <p>
          O arquivo <strong>{file.name}</strong> ({formatBytes(file.size)}) passará a ser a versão pública
          {currentVersion ? ` no lugar da versão ${currentVersion}` : ""}. A versão anterior continua no histórico, com o
          seu SHA-256, mas deixa de ser baixada no repositório.
        </p>
      ) : (
        <>
          <div className="field">
            <label htmlFor="replace-pdf-file">
              <span>Novo arquivo PDF</span>
            </label>
            <input
              id="replace-pdf-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)}
            />
            <small className="field-hint">
              {file ? `${file.name} · ${formatBytes(file.size)}` : `Somente PDF, até ${REPOSITORY_MAX_PDF_SIZE_MB} MB.`}
            </small>
          </div>
          <Field label="Descrição da alteração (opcional)" value={description} onChange={setDescription} maxLength={2000} />
        </>
      )}
      {error && (
        <div className="form-error" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}
      <div className="modal-actions">
        <Button variant="secondary" onClick={confirming ? () => setConfirming(false) : onClose} disabled={sending}>
          {confirming ? "Voltar" : "Cancelar"}
        </Button>
        {confirming ? (
          <Button variant="success" disabled={sending} onClick={() => void send()}>
            {sending ? "Enviando…" : "Confirmar substituição"}
          </Button>
        ) : (
          <Button disabled={!file} onClick={() => setConfirming(true)}>
            Continuar
          </Button>
        )}
      </div>
    </Modal>
  )
}
