import { useState } from "react"
import type { Thesis } from "../../api/client"
import { Button, Card, Icon } from "../../components/common"
import PublishedMetadataModal from "./PublishedMetadataModal"
import ReplacePublishedPdfModal from "./ReplacePublishedPdfModal"
import UnpublishThesisModal from "./UnpublishThesisModal"

interface PublishedThesisManagementProps {
  thesis: Thesis
  /** Receives the updated thesis and the confirmation shown to the user. */
  onUpdated: (thesis: Thesis, notice: string) => void
}

type ManagementDialog = "metadata" | "file" | "unpublish" | null

/**
 * Repository actions on a published thesis, each shown only when its backend flag is true:
 * `canEditPublished` (metadata and the new PDF version) and `canUnpublish`.
 * There is intentionally no delete or republish action.
 */
export default function PublishedThesisManagement({ thesis, onUpdated }: PublishedThesisManagementProps) {
  const [dialog, setDialog] = useState<ManagementDialog>(null)
  const canEdit = thesis.permissions.canEditPublished === true
  const canUnpublish = thesis.permissions.canUnpublish === true
  if (!canEdit && !canUnpublish) return null

  const finish = (updated: Thesis, notice: string) => {
    setDialog(null)
    onUpdated(updated, notice)
  }

  return (
    <Card className="decision-card repository-management">
      <div>
        <p className="eyebrow">Repositório público</p>
        <h2>Gestão da publicação</h2>
      </div>
      <div className="inline-alert">
        <Icon name="alert" />
        <span>Cada alteração fica registrada no histórico e na auditoria e atualiza o repositório público.</span>
      </div>
      <div className="button-stack">
        {canEdit && (
          <Button variant="outline" icon="file" onClick={() => setDialog("metadata")}>
            Editar metadados
          </Button>
        )}
        {canEdit && (
          <Button variant="outline" icon="upload" onClick={() => setDialog("file")}>
            Substituir PDF
          </Button>
        )}
        {canUnpublish && (
          <button type="button" className="btn btn-danger" onClick={() => setDialog("unpublish")}>
            Despublicar
          </button>
        )}
      </div>
      {dialog === "metadata" && (
        <PublishedMetadataModal
          thesis={thesis}
          onClose={() => setDialog(null)}
          onSaved={(updated) => finish(updated, "Metadados da monografia publicada atualizados.")}
        />
      )}
      {dialog === "file" && (
        <ReplacePublishedPdfModal
          thesis={thesis}
          onClose={() => setDialog(null)}
          onReplaced={(updated) => {
            const version = updated.currentFile?.versionNumber
            finish(updated, version ? `Novo PDF publicado como versão ${version}.` : "Novo PDF publicado.")
          }}
        />
      )}
      {dialog === "unpublish" && (
        <UnpublishThesisModal
          thesis={thesis}
          onClose={() => setDialog(null)}
          onUnpublished={(updated) => finish(updated, "Monografia despublicada e arquivada. Ela não aparece mais no repositório público.")}
        />
      )}
    </Card>
  )
}
