import { useState } from "react"
import { thesesApi, type DefenseThesisSummary } from "../../api/client"
import { Badge, Button, Card, Icon, Modal, PdfViewer } from "../../components/common"

interface Props {
  summary?: DefenseThesisSummary
}

/**
 * Cartão com a monografia avaliada pela banca.
 *
 * Usa o resumo embutido no payload da defesa (`thesisSummary`) para exibir os
 * dados e abrir o PDF sem uma segunda requisição. Sessões externas recebem
 * `previewUrl`/`downloadUrl` nulos e veem apenas os metadados.
 */
export default function DefenseThesisCard({ summary }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState("")

  if (!summary) return null

  const currentFile = summary.currentFile
  const previewUrl = currentFile?.previewUrl ?? null
  const downloadUrl = currentFile?.downloadUrl ?? null
  const studentName = summary.student?.name ?? "Autor não informado"
  const advisorName = summary.advisor?.name ?? "Orientador não informado"

  const download = async () => {
    if (!downloadUrl || !currentFile) return
    setDownloading(true)
    setDownloadError("")
    try {
      const filename = currentFile.originalFilename || `${summary.referenceCode}.pdf`
      await thesesApi.downloadFile(downloadUrl, filename)
    } catch (reason) {
      setDownloadError(
        reason instanceof Error ? reason.message : "Não foi possível baixar o arquivo.",
      )
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Card className="defense-thesis">
      <div className="section-head defense-section-head">
        <div>
          <p className="eyebrow">Monografia em avaliação</p>
          <h2>{summary.title}</h2>
        </div>
        <Badge tone="light">{summary.statusLabel}</Badge>
      </div>
      <p className="defense-thesis-meta">
        <strong>{studentName}</strong>
        {" · "}
        {summary.course.name}
        {" · "}
        Orientação: {advisorName}
      </p>
      {summary.keywords.length > 0 && (
        <div className="tags">
          {summary.keywords.map((keyword) => (
            <Badge tone="light" key={keyword}>
              {keyword}
            </Badge>
          ))}
        </div>
      )}
      {currentFile ? (
        <div className="defense-actions">
          <Button
            variant="secondary"
            icon="file"
            disabled={!previewUrl}
            onClick={() => setPreviewOpen(true)}
          >
            Visualizar PDF
          </Button>
          <Button
            variant="ghost"
            icon="download"
            disabled={!downloadUrl || downloading}
            onClick={() => void download()}
          >
            {downloading ? "Baixando…" : "Baixar PDF"}
          </Button>
        </div>
      ) : (
        <p>Nenhum arquivo atual disponível para esta monografia.</p>
      )}
      {downloadError && (
        <div className="inline-alert" role="alert">
          <Icon name="alert" size={18} />
          <span>{downloadError}</span>
        </div>
      )}
      {previewOpen && currentFile && previewUrl && (
        <Modal className="pdf-modal" onClose={() => setPreviewOpen(false)} labelledBy="defense-thesis-pdf-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">Monografia</p>
              <h2 id="defense-thesis-pdf-title">{summary.title}</h2>
            </div>
            <button
              className="icon-btn"
              onClick={() => setPreviewOpen(false)}
              aria-label="Fechar visualização"
            >
              <Icon name="close" />
            </button>
          </div>
          <PdfViewer
            src={previewUrl}
            filename={currentFile.originalFilename}
            downloadPath={downloadUrl ?? undefined}
            height={480}
          />
        </Modal>
      )}
    </Card>
  )
}
