import { afterAll, afterEach, beforeEach, expect, jest, test } from "@jest/globals"
import { ApiError, reportsApi } from "./client"

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>()
const createObjectURL = jest.fn<string, [Blob | MediaSource]>()
const revokeObjectURL = jest.fn<void, [string]>()
const savedNames: string[] = []
const originalFetch = globalThis.fetch
const originalCreateObjectURL = window.URL.createObjectURL
const originalRevokeObjectURL = window.URL.revokeObjectURL

beforeEach(() => {
  globalThis.fetch = fetchMock
  window.URL.createObjectURL = createObjectURL
  window.URL.revokeObjectURL = revokeObjectURL
  createObjectURL.mockReturnValue("blob:relatorio")
  savedNames.length = 0
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    savedNames.push(this.download)
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  fetchMock.mockReset()
})

afterAll(() => {
  globalThis.fetch = originalFetch
  window.URL.createObjectURL = originalCreateObjectURL
  window.URL.revokeObjectURL = originalRevokeObjectURL
})

function pdfResponse(disposition: string | null): Response {
  const headers = new Headers({ "Content-Type": "application/pdf" })
  if (disposition) headers.set("Content-Disposition", disposition)
  return new Response(new Blob(["%PDF-1.4"]), { status: 200, headers })
}

test("requests the PDF with the filters and the session cookie, saving the backend file name", async () => {
  fetchMock.mockResolvedValue(pdfResponse('attachment; filename="relatorio-tcc-20261119-1405.pdf"'))

  await reportsApi.exportPdf({ courseId: "course-si", advisorId: undefined, year: 2025 })

  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe("http://localhost:8000/api/v1/reports/overview/pdf?courseId=course-si&year=2025")
  expect(init?.credentials).toBe("include")
  expect(init?.cache).toBe("no-store")
  expect(savedNames).toEqual(["relatorio-tcc-20261119-1405.pdf"])
})

test("falls back to a default file name when the header is not exposed", async () => {
  fetchMock.mockResolvedValue(pdfResponse(null))

  await reportsApi.exportPdf()

  expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:8000/api/v1/reports/overview/pdf")
  expect(savedNames).toEqual(["relatorio-tcc.pdf"])
})

test("throws ApiError with the status and backend message on failure", async () => {
  const body = JSON.stringify({ detail: "Limite de requisições excedido." })
  fetchMock.mockResolvedValue(new Response(body, { status: 429, headers: { "Content-Type": "application/json" } }))

  const failure = reportsApi.exportPdf({ year: 2025 })

  await expect(failure).rejects.toBeInstanceOf(ApiError)
  await expect(failure).rejects.toMatchObject({ status: 429, message: "Limite de requisições excedido." })
  expect(savedNames).toEqual([])
})
