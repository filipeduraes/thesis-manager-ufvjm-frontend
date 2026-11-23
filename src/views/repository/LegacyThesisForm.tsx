import { useRef, useState } from "react"
import type { FormEvent } from "react"
import { repositoryApi, type Thesis } from "../../api/client"
import { Breadcrumb, Button, Card, Icon, PageTitle, SelectField } from "../../components/common"
import { formatBytes } from "../../data/thesisStatus"
import { validatePdfFile } from "../../data/pdfFile"
import { useRepositoryCourses } from "../../hooks/useRepositoryCourses"
import type { LegacyThesisInput } from "../../types"
import RepositoryMetadataFields from "./RepositoryMetadataFields"
import {
  LEGACY_RESULT_OPTIONS,
  REPOSITORY_MAX_PDF_SIZE_MB,
  draftToMetadata,
  emptyRepositoryDraft,
  repositoryErrorMessage,
  validateRepositoryDraft,
  type RepositoryMetadataDraft,
} from "./repositoryForm"

interface LegacyThesisFormProps {
  /** Label of the parent tab, used as the first breadcrumb item. */
  parentLabel: string
  onCancel: () => void
  onCreated: (thesis: Thesis) => void
}

/**
 * Registration of an already approved thesis from the former collection
 * (`POST /api/v1/theses/legacy`), published at once by the backend.
 */
export default function LegacyThesisForm({ parentLabel, onCancel, onCreated }: LegacyThesisFormProps) {
  const courses = useRepositoryCourses()
  const [draft, setDraft] = useState<RepositoryMetadataDraft>(emptyRepositoryDraft)
  const [result, setResult] = useState<LegacyThesisInput["result"]>("APPROVED")
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const chooseFile = async (chosen: File | null) => {
    setFile(null)
    setFileError("")
    if (!chosen) return
    const problem = await validatePdfFile(chosen, REPOSITORY_MAX_PDF_SIZE_MB)
    if (problem) {
      setFileError(problem)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }
    setFile(chosen)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submittingRef.current) return
    const problem = validateRepositoryDraft(draft)
    if (problem) {
      setError(problem)
      return
    }
    if (!file) {
      setError("Selecione o PDF da monografia.")
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setError("")
    try {
      const response = await repositoryApi.createLegacy({ ...draftToMetadata(draft), result, file })
      onCreated(response.thesis)
    } catch (reason) {
      setError(repositoryErrorMessage(reason, "Não foi possível cadastrar a monografia."))
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="page-content">
      <Breadcrumb items={[{ label: parentLabel, onClick: onCancel }, { label: "Cadastrar monografia do acervo" }]} />
      <PageTitle
        eyebrow="Repositório institucional"
        title="Cadastrar monografia do acervo"
        subtitle="Registre um trabalho aprovado antes do sistema. Ele é publicado no repositório público assim que o cadastro é concluído."
      />
      <Card>
        <form className="repository-form" onSubmit={(event) => void submit(event)} noValidate>
          <RepositoryMetadataFields idPrefix="legacy" draft={draft} onChange={setDraft} courses={courses} disabled={submitting} />
          <SelectField
            label="Resultado da banca"
            options={[...LEGACY_RESULT_OPTIONS]}
            value={result}
            onChange={(value) => setResult(value === "APPROVED_WITH_REMARKS" ? "APPROVED_WITH_REMARKS" : "APPROVED")}
            disabled={submitting}
            hint="Apenas monografias aprovadas podem ser cadastradas no repositório."
          />
          <div className="field">
            <label htmlFor="legacy-file">
              <span>Arquivo PDF</span>
            </label>
            <input
              id="legacy-file"
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              aria-describedby="legacy-file-hint"
              disabled={submitting}
              onChange={(event) => void chooseFile(event.target.files?.[0] ?? null)}
            />
            <small id="legacy-file-hint" className="field-hint">
              {file
                ? `${file.name} · ${formatBytes(file.size)}`
                : `Somente PDF, até ${REPOSITORY_MAX_PDF_SIZE_MB} MB. O SHA-256 é calculado pelo servidor.`}
            </small>
          </div>
          {fileError && (
            <div className="form-error" role="alert">
              <Icon name="alert" size={16} />
              <span>{fileError}</span>
            </div>
          )}
          {error && (
            <div className="form-error" role="alert">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}
          <div className="repository-form-actions">
            <Button type="submit" variant="success" icon="book" disabled={submitting}>
              {submitting ? "Cadastrando…" : "Cadastrar e publicar"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
