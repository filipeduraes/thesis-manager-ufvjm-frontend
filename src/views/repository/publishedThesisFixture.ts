import type { Thesis, ThesisPermissions } from "../../api/client"

const NO_PERMISSIONS: ThesisPermissions = {
  canEdit: false,
  canUpload: false,
  canSubmit: false,
  canWithdrawSubmission: false,
  canReview: false,
  canManage: true,
  canPublish: false,
  canRecordDefenseResult: false,
  canUploadDocuments: false,
  canUploadCorrection: false,
  canUnpublish: false,
  canEditPublished: false,
  canDelete: false,
}

/** Internal payload of a published thesis (`thesis_payload`) for component tests. */
export function publishedThesis(permissions: Partial<ThesisPermissions> = {}): Thesis {
  return {
    id: "thesis-1",
    referenceCode: "TCC-2024-0001",
    type: "MONOGRAPH",
    typeLabel: "Monografia",
    title: "Gestão hídrica no Vale do Jequitinhonha",
    abstract: "Resumo publicado.",
    journal: "",
    status: "PUBLISHED",
    statusLabel: "Publicada",
    statusDescription: "",
    progressStep: 5,
    isPublic: true,
    course: { id: "course-1", name: "Engenharia Ambiental", code: "EAM" },
    advisor: { id: "advisor-1", name: "Helena Prado", email: "helena.prado@ufvjm.edu.br" },
    student: null,
    authors: [{ id: "author-1", position: 1, isMainAuthor: true, name: "Camila Nunes", user: null }],
    keywords: ["Água", "Tecnologia social"],
    currentFile: {
      id: "file-1",
      versionNumber: 1,
      isCurrent: true,
      changeDescription: "",
      uploadedAt: "2024-06-01T12:00:00Z",
      hashVerifiedAt: "2024-06-01T12:00:00Z",
      storedFile: {
        id: "stored-1",
        originalFilename: "tcc.pdf",
        mimeType: "application/pdf",
        extension: "pdf",
        sizeBytes: 2048,
        sha256: "a".repeat(64),
        processingStatus: "COMPLETED",
        uploadedAt: "2024-06-01T12:00:00Z",
      },
      downloadUrl: "/api/v1/theses/thesis-1/files/file-1/download",
      previewUrl: "/api/v1/theses/thesis-1/files/file-1/download?disposition=inline",
    },
    submittedAt: null,
    advisorApprovedAt: null,
    publishedAt: "2024-06-01T12:00:00Z",
    origin: "LEGACY_IMPORT",
    originLabel: "Cadastro manual de acervo",
    defenseDate: "2024-05-10",
    defenseYear: 2024,
    createdAt: "2024-06-01T12:00:00Z",
    updatedAt: "2024-06-01T12:00:00Z",
    permissions: { ...NO_PERMISSIONS, ...permissions },
  }
}

/** Valid minimal PDF chosen in file inputs (passes the `%PDF-` signature check). */
export function pdfFile(name = "tcc.pdf"): File {
  return new File(["%PDF-1.4\n%%EOF"], name, { type: "application/pdf" })
}
