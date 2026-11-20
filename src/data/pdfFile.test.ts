import { describe, expect, it } from "@jest/globals"
import { validatePdfFile } from "./pdfFile"

function makeFile(content: string, name: string, type = "application/pdf"): File {
  return new File([content], name, { type })
}

describe("validatePdfFile", () => {
  it("aceita um PDF com assinatura válida dentro do limite", async () => {
    expect(await validatePdfFile(makeFile("%PDF-1.7 conteúdo", "tcc.pdf"), 50)).toBe("")
  })

  it("rejeita outras extensões e tipos", async () => {
    expect(await validatePdfFile(makeFile("%PDF-1.7", "tcc.docx"), 50)).toMatch(/Selecione um arquivo PDF/)
    expect(await validatePdfFile(makeFile("%PDF-1.7", "tcc.pdf", "image/png"), 50)).toMatch(/Selecione um arquivo PDF/)
  })

  it("rejeita arquivo vazio", async () => {
    expect(await validatePdfFile(makeFile("", "tcc.pdf"), 50)).toMatch(/vazio/)
  })

  it("rejeita arquivo acima do limite informando o tamanho", async () => {
    const big = makeFile("%PDF-1.7".padEnd(3 * 1024 * 1024, "x"), "tcc.pdf")
    expect(await validatePdfFile(big, 2)).toMatch(/excede o limite de 2 MB/)
  })

  it("rejeita arquivo renomeado que não é PDF de verdade", async () => {
    expect(await validatePdfFile(makeFile("PK\u0003\u0004 zip", "tcc.pdf"), 50)).toMatch(/não parece ser um PDF válido/)
  })
})
