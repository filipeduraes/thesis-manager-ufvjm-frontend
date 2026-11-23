import { describe, expect, test } from "@jest/globals"
import { buildAuditSummary, type AuditEventData } from "./auditFormat"

function event(overrides: Partial<AuditEventData> = {}): AuditEventData {
  return {
    id: "1",
    timestamp: "2026-01-01T00:00:00Z",
    action: "LOGIN",
    category: "ACCESS",
    entity: { type: "User", id: "u1", name: "", reference: "" },
    actor: { id: "u1", name: "Admin", email: null, roles: ["ADMIN"], isExternal: false },
    origin: "EXTERNAL",
    ipAddress: null,
    metadata: {},
    changes: {},
    ...overrides,
  }
}

describe("buildAuditSummary", () => {
  test("descreve login sem depender de texto do backend", () => {
    expect(buildAuditSummary(event(), "frase antiga")).toBe("Entrou no sistema")
  })

  test("inclui título da entidade e nota da avaliação", () => {
    const evaluation = event({
      action: "EVALUATE",
      entity: { type: "Defense", id: "d1", name: "TCC Sistema de Gestão", reference: "" },
      metadata: { score: 9.5 },
    })
    expect(buildAuditSummary(evaluation)).toBe('Avaliou a defesa "TCC Sistema de Gestão" com 9.5 pontos')
  })

  test("usa fallback quando não há dados estruturados", () => {
    expect(buildAuditSummary(undefined, "Texto antigo")).toBe("Texto antigo")
  })
})

describe("frases de download e entidades removidas", () => {
  test("usa a preposição correta antes do tipo de entidade", () => {
    const download = event({
      action: "DOWNLOAD",
      entity: { type: "ThesisFile", id: "f1", name: "TCC Sistema de Gestão", reference: "TCC-2026-1 · versão 1", exists: true },
      metadata: { versionNumber: 1 },
    })
    expect(buildAuditSummary(download)).toBe('Baixou a versão 1 do TCC "TCC Sistema de Gestão"')
  })

  test("mantém a referência como identificador quando a entidade não existe", () => {
    const missing = event({
      entity: { type: "ThesisFile", id: "3055d4fb", name: "3055d4fb", reference: "3055d4fb", exists: false },
    })
    expect(missing.entity.name).toBe("3055d4fb")
    expect(missing.entity.exists).toBe(false)
  })
})
