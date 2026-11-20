import { formatBytes } from "./thesisStatus"

const BYTES_PER_MB = 1024 * 1024
const PDF_SIGNATURE = "%PDF-"

function readSignature(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.onerror = () => resolve("")
    reader.readAsText(file.slice(0, PDF_SIGNATURE.length), "latin1")
  })
}

/**
 * Quick client-side check of a PDF chosen by the user, to give feedback before the upload.
 *
 * Checks the extension, the declared type, emptiness, the size limit and the `%PDF-`
 * signature. It is only a convenience: the backend validates the content, size and
 * integrity (SHA-256) and its rejection is always shown.
 *
 * @returns A message in Portuguese describing the problem, or an empty string when the file looks valid.
 */
export async function validatePdfFile(file: File, maxSizeMb: number): Promise<string> {
  const looksLikePdfName = file.name.toLowerCase().endsWith(".pdf")
  const declaredTypeIsOther = Boolean(file.type) && file.type !== "application/pdf"
  if (!looksLikePdfName || declaredTypeIsOther) {
    return "Selecione um arquivo PDF. Outros formatos não são aceitos."
  }
  if (file.size === 0) return "O arquivo está vazio. Selecione outro PDF."
  if (file.size > maxSizeMb * BYTES_PER_MB) {
    return `O arquivo tem ${formatBytes(file.size)} e excede o limite de ${maxSizeMb} MB.`
  }
  const signature = await readSignature(file)
  if (signature !== PDF_SIGNATURE) {
    return "O arquivo não parece ser um PDF válido. Exporte o documento novamente como PDF e tente de novo."
  }
  return ""
}
