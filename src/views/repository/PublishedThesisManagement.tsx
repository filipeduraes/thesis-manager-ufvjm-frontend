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
  const archived = thesis.status === "ARCHIVED" && Boolean(thesis.publishedAt)
  if (archived) {
    const archiveEntry = thesis.statusHistory?.find((entry) => entry.newStatus === "ARCHIVED")
    return (
      <Card className="repository-management">
        <h2>Publicação arquivada</h2>
        <p>A monografia foi retirada do repositório público. Os arquivos e o histórico seguem disponíveis neste detalhe.</p>
        {archiveEntry?.reason && <p><strong>Motivo da despublicação</strong> · {archiveEntry.reason}</p>}
      </Card>
    )
  }
  if (thesis.status !== "PUBLISHED" || (!canEdit && !canUnpublish)) return null

  const finish = (updated: Thesis, notice: string) => {
    setDialog(null)
    onUpdated(updated, notice)
  }

  return (
    <Card className="repository-management">
      <div>
        <p className="eyebrow">Repositório público</p>
        <h2>Gestão da publicação</h2>
      </div>
      <div className="inline-alert">
        <Icon name="alert" />
        <span>As ações afetam a publicação no repositório e ficam registradas no histórico.</span>
      </div>
      <div className="repository-management-actions">
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
