import { beforeEach, expect, jest, test } from "@jest/globals"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ApiError, repositoryApi, usersApi } from "../../api/client"
import PublishedThesisManagement from "./PublishedThesisManagement"
import { pdfFile, publishedThesis } from "./publishedThesisFixture"

const courses = jest.spyOn(repositoryApi, "courses")
const updatePublished = jest.spyOn(repositoryApi, "updatePublished")
const replacePublishedFile = jest.spyOn(repositoryApi, "replacePublishedFile")
const unpublish = jest.spyOn(repositoryApi, "unpublish")
const suggest = jest.spyOn(usersApi, "suggest")

beforeEach(() => {
  courses.mockReset().mockResolvedValue({
    count: 2,
    results: [
      { id: "course-1", name: "Engenharia Ambiental", code: "EAM" },
      { id: "course-2", name: "História", code: "HIS" },
    ],
  })
  updatePublished.mockReset()
  replacePublishedFile.mockReset()
  unpublish.mockReset()
  suggest.mockReset().mockResolvedValue({ results: [] })
})

test("não exibe ações quando o backend não concede permissões", () => {
  const { container } = render(<PublishedThesisManagement thesis={publishedThesis({ canDelete: true })} onUpdated={jest.fn()} />)
  expect(container.innerHTML).toBe("")
  expect(screen.queryByRole("button", { name: /Excluir/ })).toBeNull()
})

test("exibe cada ação apenas com a flag correspondente, sem excluir nem republicar", () => {
  const { rerender } = render(<PublishedThesisManagement thesis={publishedThesis({ canUnpublish: true })} onUpdated={jest.fn()} />)
  expect(screen.getByRole("button", { name: "Despublicar" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Editar metadados" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Substituir PDF" })).toBeNull()

  rerender(<PublishedThesisManagement thesis={publishedThesis({ canEditPublished: true })} onUpdated={jest.fn()} />)
  expect(screen.getByRole("button", { name: "Editar metadados" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Substituir PDF" })).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Despublicar" })).toBeNull()
  expect(screen.queryByRole("button", { name: /Excluir|Republicar/ })).toBeNull()
})

test("edita metadados enviando só os campos alterados e o motivo", async () => {
  const updated = { ...publishedThesis({ canEditPublished: true }), title: "Novo título" }
  updatePublished.mockResolvedValue({ thesis: updated })
  const onUpdated = jest.fn()
  render(<PublishedThesisManagement thesis={publishedThesis({ canEditPublished: true })} onUpdated={onUpdated} />)

  userEvent.click(screen.getByRole("button", { name: "Editar metadados" }))
  const dialog = await screen.findByRole("dialog", { name: "Editar metadados publicados" })
  await within(dialog).findByRole("option", { name: "História (HIS)" })
  expect(within(dialog).getByLabelText("Título")).toHaveProperty("value", "Gestão hídrica no Vale do Jequitinhonha")
  expect(within(dialog).getByLabelText(/^Curso/)).toHaveProperty("value", "course-1")

  userEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }))
  expect(await within(dialog).findByText("Nenhuma alteração foi informada.")).toBeTruthy()
  expect(updatePublished).not.toHaveBeenCalled()

  userEvent.clear(within(dialog).getByLabelText("Título"))
  userEvent.type(within(dialog).getByLabelText("Título"), "Novo título")
  userEvent.type(within(dialog).getByLabelText(/^Palavras-chave/), ", Semiárido")
  userEvent.type(within(dialog).getByLabelText(/^Motivo da alteração/), "Correção do título")
  userEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }))

  await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated, "Metadados da monografia publicada atualizados."))
  expect(suggest).not.toHaveBeenCalled()
  expect(updatePublished).toHaveBeenCalledWith("thesis-1", {
    title: "Novo título",
    keywords: ["Água", "Tecnologia social", "Semiárido"],
    reason: "Correção do título",
  })
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("mostra a recusa do backend ao editar sem fechar o modal", async () => {
  updatePublished.mockRejectedValue(new ApiError("Apenas administradores ou a coordenação do curso podem gerenciar esta monografia.", 403))
  render(<PublishedThesisManagement thesis={publishedThesis({ canEditPublished: true })} onUpdated={jest.fn()} />)
  userEvent.click(screen.getByRole("button", { name: "Editar metadados" }))
  const dialog = await screen.findByRole("dialog", { name: "Editar metadados publicados" })
  await within(dialog).findByRole("option", { name: "História (HIS)" })
  userEvent.selectOptions(within(dialog).getByLabelText(/^Curso/), "course-2")
  userEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }))
  expect(
    await within(dialog).findByText("Apenas administradores ou a coordenação do curso podem gerenciar esta monografia."),
  ).toBeTruthy()
  expect(updatePublished).toHaveBeenCalledWith("thesis-1", { courseId: "course-2" })
})

test("substitui o PDF como nova versão somente após confirmação", async () => {
  const base = publishedThesis({ canEditPublished: true })
  const currentFile = base.currentFile ? { ...base.currentFile, id: "file-2", versionNumber: 2 } : null
  const updated = { ...base, currentFile }
  if (!currentFile) throw new Error("fixture sem arquivo")
  replacePublishedFile.mockResolvedValue({ file: currentFile, thesis: updated })
  const onUpdated = jest.fn()
  render(<PublishedThesisManagement thesis={base} onUpdated={onUpdated} />)

  userEvent.click(screen.getByRole("button", { name: "Substituir PDF" }))
  const dialog = await screen.findByRole("dialog", { name: "Substituir PDF publicado" })
  expect(within(dialog).getByRole("button", { name: "Continuar" })).toHaveProperty("disabled", true)
  const file = pdfFile("corrigida.pdf")
  userEvent.upload(within(dialog).getByLabelText("Novo arquivo PDF"), file)
  await within(dialog).findByText(/corrigida\.pdf ·/)
  userEvent.type(within(dialog).getByLabelText("Descrição da alteração (opcional)"), "Correção da ficha catalográfica")
  userEvent.click(within(dialog).getByRole("button", { name: "Continuar" }))

  expect(await screen.findByRole("dialog", { name: "Confirmar substituição do PDF?" })).toBeTruthy()
  expect(screen.getByText(/no lugar da versão 1/)).toBeTruthy()
  expect(replacePublishedFile).not.toHaveBeenCalled()
  userEvent.click(screen.getByRole("button", { name: "Confirmar substituição" }))

  await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated, "Novo PDF publicado como versão 2."))
  expect(replacePublishedFile).toHaveBeenCalledWith("thesis-1", file, "Correção da ficha catalográfica")
})

test("mostra a recusa do backend para PDF idêntico ou de outra monografia", async () => {
  replacePublishedFile.mockRejectedValue(new ApiError("Este PDF já está cadastrado em outra monografia.", 400))
  render(<PublishedThesisManagement thesis={publishedThesis({ canEditPublished: true })} onUpdated={jest.fn()} />)
  userEvent.click(screen.getByRole("button", { name: "Substituir PDF" }))
  userEvent.upload(await screen.findByLabelText("Novo arquivo PDF"), pdfFile())
  await screen.findByText(/tcc\.pdf ·/)
  userEvent.click(screen.getByRole("button", { name: "Continuar" }))
  userEvent.click(await screen.findByRole("button", { name: "Confirmar substituição" }))
  expect(await screen.findByText("Este PDF já está cadastrado em outra monografia.")).toBeTruthy()
})

test("despublica apenas com motivo e confirmação", async () => {
  const archived = { ...publishedThesis(), status: "ARCHIVED" as const, statusLabel: "Arquivada", isPublic: false }
  unpublish.mockResolvedValue({ thesis: archived })
  const onUpdated = jest.fn()
  render(<PublishedThesisManagement thesis={publishedThesis({ canUnpublish: true })} onUpdated={onUpdated} />)

  userEvent.click(screen.getByRole("button", { name: "Despublicar" }))
  const dialog = await screen.findByRole("dialog", { name: "Despublicar monografia?" })
  const confirm = within(dialog).getByRole("button", { name: "Confirmar despublicação" })
  expect(confirm).toHaveProperty("disabled", true)
  userEvent.type(within(dialog).getByLabelText("Motivo da despublicação"), "   ")
  expect(confirm).toHaveProperty("disabled", true)
  userEvent.type(within(dialog).getByLabelText("Motivo da despublicação"), "Solicitação do autor")
  userEvent.click(confirm)

  await waitFor(() =>
    expect(onUpdated).toHaveBeenCalledWith(archived, "Monografia despublicada e arquivada. Ela não aparece mais no repositório público."),
  )
  expect(unpublish).toHaveBeenCalledWith("thesis-1", "Solicitação do autor")
})

test("mostra a situação e o motivo de uma publicação arquivada", () => {
  const thesis = publishedThesis({ canEditPublished: true, canUnpublish: true })
  render(
    <PublishedThesisManagement
      thesis={{
        ...thesis,
        status: "ARCHIVED",
        isPublic: false,
        statusHistory: [{
          id: "history-1",
          previousStatus: "PUBLISHED",
          newStatus: "ARCHIVED",
          newStatusLabel: "Arquivada",
          reason: "Solicitação do autor",
          changedAt: thesis.updatedAt,
          changedBy: null,
          metadata: {},
        }],
      }}
      onUpdated={jest.fn()}
    />,
  )

  expect(screen.getByRole("heading", { name: "Publicação arquivada" })).toBeTruthy()
  expect(screen.getByText(/Solicitação do autor/)).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Despublicar" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Editar metadados" })).toBeNull()
})

test("mantém o modal de despublicação aberto com a mensagem do backend", async () => {
  unpublish.mockRejectedValue(new ApiError("Apenas monografias publicadas podem ser despublicadas.", 400))
  render(<PublishedThesisManagement thesis={publishedThesis({ canUnpublish: true })} onUpdated={jest.fn()} />)
  userEvent.click(screen.getByRole("button", { name: "Despublicar" }))
  userEvent.type(await screen.findByLabelText("Motivo da despublicação"), "Duplicada")
  userEvent.click(screen.getByRole("button", { name: "Confirmar despublicação" }))
  expect(await screen.findByText("Apenas monografias publicadas podem ser despublicadas.")).toBeTruthy()
  expect(screen.getByRole("dialog", { name: "Despublicar monografia?" })).toBeTruthy()
})
