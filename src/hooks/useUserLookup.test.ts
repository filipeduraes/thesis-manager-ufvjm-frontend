import { beforeEach, describe, expect, it, jest } from "@jest/globals"
import { renderHook, waitFor } from "@testing-library/react"

import { useUserLookup } from "./useUserLookup"

const mockLookup = jest.fn()
jest.mock("../api/client", () => ({
  adminApi: {
    lookupUser: (...args: unknown[]) => mockLookup(...args),
  },
}))


describe("useUserLookup", () => {
  beforeEach(() => {
    mockLookup.mockReset()
  })

  it("limpa o estado de carregamento quando o e-mail é apagado durante a busca", async () => {
    let resolveLookup: ((value: unknown) => void) | undefined
    mockLookup.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve
        }),
    )

    const { result, rerender } = renderHook(({ email }) => useUserLookup(email), {
      initialProps: { email: "nome@ufvjm.edu.br" },
    })

    await waitFor(() => expect(result.current.loading).toBe(true))
    rerender({ email: "" })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.lookup).toBeNull()

    resolveLookup?.({ found: false })
  })
})
