import { afterAll, afterEach, beforeEach, expect, jest, test } from "@jest/globals"
import { ApiError, defenseApi } from "./client"

const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>()
const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = fetchMock
})

afterEach(() => {
  fetchMock.mockReset()
})

afterAll(() => {
  globalThis.fetch = originalFetch
})

test("expõe código e avisos do conflito amarelo e reenvia com confirmação", async () => {
  const warning = { memberName: "Profa. Membro", defenseId: "defense-2", scheduledDatetime: "2026-12-10T14:00:00Z", scheduledEndDatetime: "2026-12-10T16:00:00Z" }
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ detail: "Banca próxima de outra defesa.", code: "SCHEDULE_WARNING", warnings: [warning] }), { status: 409, headers: { "Content-Type": "application/json" } }),
  )

  try {
    await defenseApi.addInstitutionalMember("defense-1", { role: "MEMBER", userId: "user-1" })
    throw new Error("a requisição deveria falhar")
  } catch (reason) {
    expect(reason).toBeInstanceOf(ApiError)
    const error = reason as ApiError
    expect(error.status).toBe(409)
    expect(error.code).toBe("SCHEDULE_WARNING")
    expect(error.warnings).toEqual([warning])
  }

  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ member: { id: "member-1" } }), { status: 201, headers: { "Content-Type": "application/json" } }))
  await defenseApi.addInstitutionalMember("defense-1", { role: "MEMBER", userId: "user-1", acknowledgeScheduleWarning: true })

  const secondBody = JSON.parse(fetchMock.mock.calls[1][1]?.body as string) as Record<string, unknown>
  expect(secondBody.acknowledgeScheduleWarning).toBe(true)
})
