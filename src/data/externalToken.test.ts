import { describe, expect, it } from "@jest/globals"
import { buildExternalToken, formatExternalTokenCode, isExternalTokenComplete } from "./externalToken"

describe("formatExternalTokenCode", () => {
  it("agrupa o código em blocos de quatro e usa maiúsculas", () => {
    expect(formatExternalTokenCode("abcdefgh")).toBe("ABCD-EFGH")
  })

  it("aceita o token completo colado com ou sem hifens e espaços", () => {
    expect(formatExternalTokenCode("UFVJM-ABCD-EFGH-JKLM-NPQR")).toBe("ABCD-EFGH-JKLM-NPQR")
    expect(formatExternalTokenCode("  ufvjm abcd efgh jklm npqr ")).toBe("ABCD-EFGH-JKLM-NPQR")
    expect(formatExternalTokenCode("UFVJMABCDEFGHJKLMNPQR")).toBe("ABCD-EFGH-JKLM-NPQR")
  })

  it("trata as letras iniciais UFVJM como prefixo, inclusive digitadas aos poucos", () => {
    expect(formatExternalTokenCode("UFVJM")).toBe("")
    expect(formatExternalTokenCode("UFVJM-")).toBe("")
    expect(formatExternalTokenCode("UFVJM-AB")).toBe("AB")
  })

  it("ignora caracteres extras além dos 16 do código", () => {
    expect(formatExternalTokenCode("ABCDEFGHJKLMNPQRSTUV")).toBe("ABCD-EFGH-JKLM-NPQR")
  })

  it("devolve vazio quando não há caracteres válidos", () => {
    expect(formatExternalTokenCode(" - ")).toBe("")
  })
})

describe("isExternalTokenComplete / buildExternalToken", () => {
  it("só considera completo com os 16 caracteres", () => {
    expect(isExternalTokenComplete("ABCD-EFGH-JKLM-NPQ")).toBe(false)
    expect(isExternalTokenComplete("ABCD-EFGH-JKLM-NPQR")).toBe(true)
  })

  it("monta o token com o prefixo institucional", () => {
    expect(buildExternalToken("ABCD-EFGH-JKLM-NPQR")).toBe("UFVJM-ABCD-EFGH-JKLM-NPQR")
  })
})
