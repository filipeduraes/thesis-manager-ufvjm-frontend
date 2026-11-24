import { expect, jest, test } from "@jest/globals"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ApiError, defenseApi, type DefenseData } from "../../api/client"
import DefenseEditModal from "./DefenseEditModal"

const update = jest.spyOn(defenseApi, "update")

const defense: DefenseData = {
  id: "defense-1",
  thesis: "thesis-1",
  scheduledDatetime: "2026-12-10T20:00:00Z",
  durationMinutes: 120,
  modality: "IN_PERSON",
  modalityLabel: "Presencial",
  location: "Auditório",
  notes: "",
  status: "SCHEDULED",
  statusLabel: "Agendada",
  createdAt: "2026-11-01T12:00:00Z",
  updatedAt: "2026-11-01T12:00:00Z",
  members: [],
}

test("confirma o aviso amarelo antes de salvar o novo horário", async () => {
  update.mockReset()
  update.mockRejectedValueOnce(new ApiError("Banca próxima de outra defesa.", 409, {
    code: "SCHEDULE_WARNING",
    warnings: [{ memberName: "Profa. Membro", defenseId: "defense-2", scheduledDatetime: "2026-12-10T14:00:00Z", scheduledEndDatetime: "2026-12-10T16:00:00Z" }],
  }))
  update.mockResolvedValueOnce({ defense })

  const onSaved = jest.fn<() => void, []>()
  render(<DefenseEditModal defense={defense} onClose={() => undefined} onSaved={onSaved} />)

  await userEvent.clear(screen.getByLabelText("Data"))
  await userEvent.type(screen.getByLabelText("Data"), "2026-12-11")
  await userEvent.click(screen.getByRole("button", { name: "Salvar alterações" }))

  expect(await screen.findByRole("dialog", { name: "Possível conflito de horário" })).toBeTruthy()
  await userEvent.click(screen.getByRole("button", { name: "Continuar mesmo assim" }))

  await waitFor(() => expect(update).toHaveBeenCalledTimes(2))
  expect(update.mock.calls[1][1]).toMatchObject({ acknowledgeScheduleWarning: true })
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
})
