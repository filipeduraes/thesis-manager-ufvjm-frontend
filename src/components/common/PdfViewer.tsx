import { useEffect, useState } from "react"
import { downloadApiFile, fetchApiBlob } from "../../api/client"
import Icon from "./Icon"

interface PdfViewerProps {
  src: string
  filename?: string
  downloadPath?: string
  className?: string
  height?: number
  emptyMessage?: string
}

type ViewerStatus = "loading" | "ready" | "error"

export default function PdfViewer({
  src,
  filename = "monografia.pdf",
  downloadPath,
  className = "",
  height = 430,
  emptyMessage = "Nenhum arquivo disponível.",
}: PdfViewerProps) {
  const [status, setStatus] = useState<ViewerStatus>("loading")
  const [error, setError] = useState("")
  const [objectUrl, setObjectUrl] = useState("")
  const [zoom, setZoom] = useState(100)
  const [reloadKey, setReloadKey] = useState(0)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!src) {
      setStatus("error")
      setError(emptyMessage)
      setObjectUrl("")
      return
    }
    let active = true
    let createdUrl = ""
    setStatus("loading")
    setError("")
    fetchApiBlob(src)
      .then((blob) => {
        if (!active) return
        createdUrl = window.URL.createObjectURL(blob)
        setObjectUrl(createdUrl)
        setStatus("ready")
      })
      .catch((reason: unknown) => {
        if (!active) return
        setStatus("error")
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar o PDF.")
      })
    return () => {
      active = false
      if (createdUrl) window.URL.revokeObjectURL(createdUrl)
    }
  }, [src, reloadKey, emptyMessage])

  const changeZoom = (delta: number) => {
    setZoom((current) => Math.min(200, Math.max(50, current + delta)))
  }

  const download = async () => {
    setDownloading(true)
    try {
      if (downloadPath) {
        await downloadApiFile(downloadPath, filename)
      } else if (objectUrl) {
        const anchor = document.createElement("a")
        anchor.href = objectUrl
        anchor.download = filename
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível baixar o arquivo.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className={`pdf-viewer ${className}`.trim()}>
      <div className="pdf-toolbar">
        <span title={filename}>
          <Icon name="file" /> {filename}
        </span>
        <div className="pdf-controls">
          <button type="button" aria-label="Diminuir zoom" onClick={() => changeZoom(-10)}>
            −
          </button>
          <button type="button" className="zoom-reset" aria-label="Restaurar zoom" onClick={() => setZoom(100)}>
            {zoom}%
          </button>
          <button type="button" aria-label="Aumentar zoom" onClick={() => changeZoom(10)}>
            +
          </button>
          <button type="button" className="btn btn-ghost" disabled={downloading || status !== "ready"} onClick={() => void download()}>
            <Icon name="download" size={16} /> {downloading ? "Baixando…" : "Baixar"}
          </button>
        </div>
      </div>
      <div className="pdf-page" style={{ height: `${height}px` }}>
        {status === "loading" && (
          <div className="pdf-feedback">
            <div className="upload-icon">
              <Icon name="file" />
            </div>
            <strong>Carregando PDF…</strong>
            <span>Verificando permissões e integridade do arquivo.</span>
          </div>
        )}
        {status === "error" && (
          <div className="pdf-feedback">
            <div className="upload-icon danger">
              <Icon name="alert" />
            </div>
            <strong>Não foi possível exibir o PDF</strong>
            <span>{error}</span>
            <button type="button" className="btn btn-outline" onClick={() => setReloadKey((key) => key + 1)}>
              Tentar novamente
            </button>
          </div>
        )}
        {status === "ready" && objectUrl && (
          <iframe
            className="pdf-frame"
            title={filename}
            src={`${objectUrl}#zoom=${zoom}&toolbar=0&navpanes=0`}
          />
        )}
      </div>
    </div>
  )
}
