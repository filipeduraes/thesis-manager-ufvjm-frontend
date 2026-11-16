import { afterAll, beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { thesesApi, type DefenseThesisSummary } from "../../api/client"
import DefenseThesisCard from "./DefenseThesisCard"

const downloadFile = jest.spyOn(thesesApi, "downloadFile")

function buildSummary(urls: boolean): DefenseThesisSummary {
  return {
    id: "thesis-1",
    referenceCode: "TCC-2026-001",
    title: "Tecnologias sociais e gestão hídrica",
    type: "MONOGRAPH",
    typeLabel: "Monografia",
    status: "UNDER_EVALUATION",
    statusLabel: "Em avaliação",
    isPublic: false,
    course: { id: "course-1", name: "Sistemas de Informação", code: "SI" },
    advisor: { id: "advisor-1", name: "Orientadora Teste", email: "orientadora@ufvjm.edu.br" },
    student: { id: "student-1", name: "Aluna Teste", email: "aluna@ufvjm.edu.br" },
    keywords: ["Saúde"],
    submittedAt: "2026-01-01T12:00:00Z",
    publishedAt: null,
    currentFile: {
      id: "file-1",
      versionNumber: 1,
      originalFilename: "monografia.pdf",
      sizeBytes: 2048,
      sha256: "abc123",
      uploadedAt: "2026-01-01T12:00:00Z",
      previewUrl: urls ? "/api/v1/theses/thesis-1/files/file-1/download?disposition=inline" : null,
      downloadUrl: urls ? "/api/v1/theses/thesis-1/files/file-1/download?disposition=attachment" : null,
    },
  }
}

beforeEach(() => {
  downloadFile.mockReset()
  downloadFile.mockResolvedValue(undefined)
})

afterAll(() => {
  jest.restoreAllMocks()
})

test("renders the embedded thesis summary with student, course and advisor", () => {
  render(<DefenseThesisCard summary={buildSummary(false)} />)

  expect(screen.getByText("Tecnologias sociais e gestão hídrica")).toBeTruthy()
  expect(screen.getByText("Aluna Teste")).toBeTruthy()
  expect(screen.getByText(/Sistemas de Informação/)).toBeTruthy()
  expect(screen.getByText(/Orientação: Orientadora Teste/)).toBeTruthy()
  expect(screen.getByText("Saúde")).toBeTruthy()
})

test("disables PDF actions for external sessions, which receive null URLs", () => {
  render(<DefenseThesisCard summary={buildSummary(false)} />)

  expect(screen.getByRole("button", { name: "Visualizar PDF" }).hasAttribute("disabled")).toBe(true)
  expect(screen.getByRole("button", { name: "Baixar PDF" }).hasAttribute("disabled")).toBe(true)
})

test("downloads the current file through the institutional endpoint", async () => {
  render(<DefenseThesisCard summary={buildSummary(true)} />)

  userEvent.click(screen.getByRole("button", { name: "Baixar PDF" }))
  expect(await screen.findByRole("button", { name: "Baixar PDF" })).toBeTruthy()
  expect(downloadFile).toHaveBeenCalledWith(
    "/api/v1/theses/thesis-1/files/file-1/download?disposition=attachment",
    "monografia.pdf",
  )
})
