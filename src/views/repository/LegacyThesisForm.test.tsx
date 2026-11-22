import { beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ApiError, repositoryApi, usersApi } from "../../api/client"
import LegacyThesisForm from "./LegacyThesisForm"
import { pdfFile, publishedThesis } from "./publishedThesisFixture"

const courses = jest.spyOn(repositoryApi, "courses")
const createLegacy = jest.spyOn(repositoryApi, "createLegacy")
const suggest = jest.spyOn(usersApi, "suggest")

const ADVISOR = { id: "advisor-1", name: "Helena Prado", email: "helena.prado@ufvjm.edu.br", avatarUrl: null }
const STUDENT = { id: "student-9", name: "Bruno Lima", email: "bruno.lima@ufvjm.edu.br", avatarUrl: null }

beforeEach(() => {
  courses.mockReset().mockResolvedValue({ count: 1, results: [{ id: "course-1", name: "Engenharia Ambiental", code: "EAM" }] })
  createLegacy.mockReset()
  suggest.mockReset().mockImplementation(async (query: string) => ({
    results: query.toLowerCase().startsWith("hel") ? [ADVISOR] : query.toLowerCase().startsWith("bru") ? [STUDENT] : [],
  }))
})

async function fillRequiredFields() {
  userEvent.type(screen.getByLabelText("Título"), "Memória do Jequitinhonha")
  userEvent.type(screen.getByLabelText("Resumo"), "Resumo do trabalho antigo.")
  userEvent.type(screen.getByLabelText(/^Palavras-chave/), "Memória, patrimônio, memória")
  userEvent.type(screen.getByLabelText("Autor 1 (principal)"), "Ana Souza")
  userEvent.click(screen.getByRole("button", { name: "Adicionar autor" }))
  userEvent.type(screen.getByLabelText("Autor 2"), "Bru")
  userEvent.click(await screen.findByRole("option", { name: /Bruno Lima/ }))
  userEvent.type(screen.getByLabelText("Orientador"), "Hel")
  userEvent.click(await screen.findByRole("option", { name: /Helena Prado/ }))
  await screen.findByRole("option", { name: "Engenharia Ambiental (EAM)" })
  userEvent.selectOptions(screen.getByLabelText(/^Curso/), "course-1")
  userEvent.type(screen.getByLabelText("Ano de defesa"), "2008")
}

test("cadastra monografia do acervo com autores por nome e por usuário e o PDF", async () => {
  const created = publishedThesis()
  createLegacy.mockResolvedValue({ thesis: created })
  const onCreated = jest.fn()
  render(<LegacyThesisForm parentLabel="Monografias" onCancel={jest.fn()} onCreated={onCreated} />)

  await fillRequiredFields()
  expect(suggest).toHaveBeenCalledWith("Hel", "ADVISOR")
  expect(screen.getByText("Vinculado ao usuário Bruno Lima (bruno.lima@ufvjm.edu.br).")).toBeTruthy()
  userEvent.selectOptions(screen.getByLabelText(/^Resultado da banca/), "APPROVED_WITH_REMARKS")
  const file = pdfFile()
  userEvent.upload(screen.getByLabelText("Arquivo PDF"), file)
  await screen.findByText(/tcc\.pdf ·/)
  userEvent.click(screen.getByRole("button", { name: "Cadastrar e publicar" }))

  await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created))
  expect(createLegacy).toHaveBeenCalledTimes(1)
  expect(createLegacy).toHaveBeenCalledWith({
    title: "Memória do Jequitinhonha",
    abstract: "Resumo do trabalho antigo.",
    keywords: ["Memória", "patrimônio"],
    authors: [{ name: "Ana Souza" }, { userId: "student-9", name: "Bruno Lima" }],
    advisorId: "advisor-1",
    courseId: "course-1",
    defenseYear: 2008,
    defenseDate: null,
    type: "MONOGRAPH",
    journal: "",
    result: "APPROVED_WITH_REMARKS",
    file,
  })
})

test("recusa arquivo que não é PDF e exige o PDF antes de enviar", async () => {
  render(<LegacyThesisForm parentLabel="Monografias" onCancel={jest.fn()} onCreated={jest.fn()} />)
  await fillRequiredFields()
  userEvent.upload(screen.getByLabelText("Arquivo PDF"), new File(["texto"], "tcc.docx", { type: "application/msword" }), undefined, {
    applyAccept: false,
  })
  expect(await screen.findByText("Selecione um arquivo PDF. Outros formatos não são aceitos.")).toBeTruthy()
  userEvent.click(screen.getByRole("button", { name: "Cadastrar e publicar" }))
  expect(await screen.findByText("Selecione o PDF da monografia.")).toBeTruthy()
  expect(createLegacy).not.toHaveBeenCalled()
})

test("valida o ano e a data de defesa antes de chamar a API", async () => {
  render(<LegacyThesisForm parentLabel="Monografias" onCancel={jest.fn()} onCreated={jest.fn()} />)
  await fillRequiredFields()
  userEvent.clear(screen.getByLabelText("Ano de defesa"))
  userEvent.type(screen.getByLabelText("Ano de defesa"), "1900")
  userEvent.upload(screen.getByLabelText("Arquivo PDF"), pdfFile())
  await screen.findByText(/tcc\.pdf ·/)
  userEvent.click(screen.getByRole("button", { name: "Cadastrar e publicar" }))
  expect(await screen.findByText(/Informe um ano de defesa entre 1950 e/)).toBeTruthy()

  userEvent.clear(screen.getByLabelText("Ano de defesa"))
  userEvent.type(screen.getByLabelText("Ano de defesa"), "2008")
  userEvent.type(screen.getByLabelText("Data de defesa (opcional)"), "2009-03-10")
  userEvent.click(screen.getByRole("button", { name: "Cadastrar e publicar" }))
  expect(await screen.findByText("A data de defesa não corresponde ao ano informado.")).toBeTruthy()
  expect(createLegacy).not.toHaveBeenCalled()
})

test("mostra a mensagem do backend (PDF duplicado e curso não coordenado)", async () => {
  createLegacy
    .mockRejectedValueOnce(new ApiError("Este PDF já está cadastrado em outra monografia.", 400))
    .mockRejectedValueOnce(new ApiError("Apenas administradores ou a coordenação do curso podem gerenciar esta monografia.", 403))
  render(<LegacyThesisForm parentLabel="Monografias" onCancel={jest.fn()} onCreated={jest.fn()} />)
  await fillRequiredFields()
  userEvent.upload(screen.getByLabelText("Arquivo PDF"), pdfFile())
  await screen.findByText(/tcc\.pdf ·/)
  userEvent.click(screen.getByRole("button", { name: "Cadastrar e publicar" }))
  expect(await screen.findByText("Este PDF já está cadastrado em outra monografia.")).toBeTruthy()
  userEvent.click(screen.getByRole("button", { name: "Cadastrar e publicar" }))
  expect(
    await screen.findByText("Apenas administradores ou a coordenação do curso podem gerenciar esta monografia."),
  ).toBeTruthy()
})

test("volta para a aba de origem pelo breadcrumb", async () => {
  const onCancel = jest.fn()
  render(<LegacyThesisForm parentLabel="Monografias" onCancel={onCancel} onCreated={jest.fn()} />)
  userEvent.click(screen.getByRole("button", { name: "Monografias" }))
  expect(onCancel).toHaveBeenCalled()
  await screen.findByRole("option", { name: "Engenharia Ambiental (EAM)" })
})
