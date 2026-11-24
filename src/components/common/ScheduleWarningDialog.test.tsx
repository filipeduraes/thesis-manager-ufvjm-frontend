import { expect, jest, test } from "@jest/globals"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ScheduleWarning } from "../../api/client"
import ScheduleWarningDialog from "./ScheduleWarningDialog"

const warning: ScheduleWarning = {
  memberName: "Profa. Membro",
  defenseId: "defense-2",
  scheduledDatetime: "2026-12-10T12:00:00Z",
  scheduledEndDatetime: "2026-12-10T14:00:00Z",
}

test("mostra o aviso amarelo e permite cancelar", async () => {
  const onConfirm = jest.fn<() => void, []>()
  const onCancel = jest.fn<() => void, []>()

  render(
    <ScheduleWarningDialog
      warnings={[warning]}
      defenseStart="2026-12-10T14:30:00Z"
      defenseDurationMinutes={120}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )

  expect(screen.getByRole("dialog")).toBeTruthy()
  expect(screen.getByText(/Profa\. Membro/)).toBeTruthy()
  expect(screen.getByText(/começa 30 minutos depois do término da outra banca/)).toBeTruthy()
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }))
  expect(onCancel).toHaveBeenCalledTimes(1)
  expect(onConfirm).not.toHaveBeenCalled()
})

test("mostra quando a nova banca termina antes da outra começar", () => {
  const laterWarning: ScheduleWarning = {
    ...warning,
    scheduledDatetime: "2026-12-10T12:30:00Z",
    scheduledEndDatetime: "2026-12-10T14:30:00Z",
  }
  render(
    <ScheduleWarningDialog
      warnings={[laterWarning]}
      defenseStart="2026-12-10T10:00:00Z"
      defenseDurationMinutes={120}
      onConfirm={() => undefined}
      onCancel={() => undefined}
    />,
  )

  expect(screen.getByText(/termina 30 minutos antes do início da outra banca/)).toBeTruthy()
})

test("confirma a operação com o aviso visto", async () => {
  const onConfirm = jest.fn<() => void, []>()
  const onCancel = jest.fn<() => void, []>()

  render(
    <ScheduleWarningDialog
      warnings={[warning]}
      defenseStart="2026-12-10T14:30:00Z"
      defenseDurationMinutes={120}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )

  await userEvent.click(screen.getByRole("button", { name: "Continuar mesmo assim" }))
  expect(onConfirm).toHaveBeenCalledTimes(1)
  expect(onCancel).not.toHaveBeenCalled()
})
