import { afterEach, expect, jest, test } from "@jest/globals"
import { repositoryApi, repositorySearchQuery } from "./client"

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

test("normaliza a busca pública: texto compactado, palavras-chave repetidas e ordenadas", () => {
  const query = repositorySearchQuery({
    q: "  gestão   hídrica ",
    courseId: "course-1",
    year: 2019,
    keywords: ["saude", "agua", "saude"],
    ordering: "title",
    page: 2,
    pageSize: 10,
  })
  expect(query).toBe(
    "?q=gest%C3%A3o+h%C3%ADdrica&courseId=course-1&year=2019&keyword=agua&keyword=saude&ordering=title&page=2&pageSize=10",
  )
  expect(repositorySearchQuery({ page: 1 })).toBe("")
})

test("envia o cadastro de acervo como multipart com autores e palavras-chave em JSON", async () => {
  const fetchMock = jest.fn(async () => new Response(JSON.stringify({ thesis: { id: "t-1" } }), { status: 201 }))
  global.fetch = fetchMock as unknown as typeof fetch
  const file = new File(["%PDF-1.4"], "tcc.pdf", { type: "application/pdf" })
  await repositoryApi.createLegacy({
    title: "Título",
    abstract: "Resumo",
    keywords: ["Água"],
    authors: [{ name: "Ana" }, { userId: "user-2", name: "Bruno" }],
    advisorId: "advisor-1",
    courseId: "course-1",
    defenseYear: 2010,
    defenseDate: null,
    result: "APPROVED",
    type: "MONOGRAPH",
    file,
  })
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toMatch(/\/api\/v1\/theses\/legacy$/)
  expect(init.method).toBe("POST")
  const body = init.body as FormData
  expect(body.get("authors")).toBe(JSON.stringify([{ name: "Ana" }, { userId: "user-2", name: "Bruno" }]))
  expect(body.get("keywords")).toBe(JSON.stringify(["Água"]))
  expect(body.get("defenseYear")).toBe("2010")
  expect(body.get("defenseDate")).toBeNull()
  expect(body.get("file")).toBe(file)
})
