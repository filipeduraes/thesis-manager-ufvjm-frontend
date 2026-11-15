import { expect, test } from "@jest/globals"
import {
  draftToScheduleInput,
  EMPTY_SCHEDULE_DRAFT,
  expectedEnd,
  formatDuration,
  isoToSaoPauloInputs,
  parseDurationMinutes,
  saoPauloInputsToIso,
  scheduleSummary,
} from "./defenseSchedule"

test("computes the expected end and flags the next day", () => {
  expect(expectedEnd("17:00", "120")).toEqual({ time: "19:00", nextDay: false })
  expect(expectedEnd("23:30", "90")).toEqual({ time: "01:00", nextDay: true })
  expect(expectedEnd("", "120")).toBeNull()
  expect(expectedEnd("17:00", "0")).toBeNull()
})

test("accepts only whole durations from 1 to 720 minutes", () => {
  expect(parseDurationMinutes("90")).toBe(90)
  expect(parseDurationMinutes("721")).toBeNull()
  expect(parseDurationMinutes("1.5")).toBeNull()
  expect(parseDurationMinutes("")).toBeNull()
})

test("summarizes date, start and end", () => {
  expect(scheduleSummary({ date: "2026-11-16", startTime: "17:00", duration: "120" })).toBe("16/11 · 17:00 às 19:00")
  expect(scheduleSummary({ date: "2026-11-16", startTime: "23:00", duration: "120" })).toBe(
    "16/11 · 23:00 às 01:00 (dia seguinte)",
  )
  expect(scheduleSummary({ date: "", startTime: "17:00", duration: "120" })).toBeNull()
})

test("converts São Paulo wall-clock time to UTC and back", () => {
  const iso = saoPauloInputsToIso("2026-11-16", "17:00")
  expect(iso).toBe("2026-11-16T20:00:00.000Z")
  expect(isoToSaoPauloInputs("2026-11-16T20:00:00.000Z")).toEqual({ date: "2026-11-16", startTime: "17:00" })
})

test("builds the payload only when required fields are valid", () => {
  expect(draftToScheduleInput(EMPTY_SCHEDULE_DRAFT)).toBeNull()
  expect(
    draftToScheduleInput({
      date: "2026-11-16",
      startTime: "17:00",
      duration: "60",
      modality: "REMOTE",
      location: " https://meet.example/abc ",
      notes: "",
    }),
  ).toEqual({
    scheduledDatetime: "2026-11-16T20:00:00.000Z",
    durationMinutes: 60,
    modality: "REMOTE",
    location: "https://meet.example/abc",
    notes: "",
  })
})

test("formats durations for display", () => {
  expect(formatDuration(45)).toBe("45 min")
  expect(formatDuration(120)).toBe("2h")
  expect(formatDuration(90)).toBe("1h30")
})

test("keeps 17:00 in São Paulo through form, payload and backend response", () => {
  const payload = draftToScheduleInput({
    date: "2026-11-16",
    startTime: "17:00",
    duration: "120",
    modality: "IN_PERSON",
    location: "",
    notes: "",
  })
  expect(payload?.scheduledDatetime).toBe("2026-11-16T20:00:00.000Z")
  // O backend (TIME_ZONE = "UTC") devolve o instante com deslocamento +00:00.
  expect(isoToSaoPauloInputs("2026-11-16T20:00:00+00:00")).toEqual({ date: "2026-11-16", startTime: "17:00" })
})

test("converts instants near midnight to the correct São Paulo day", () => {
  expect(isoToSaoPauloInputs("2026-11-17T02:30:00+00:00")).toEqual({ date: "2026-11-16", startTime: "23:30" })
  expect(isoToSaoPauloInputs("2026-11-17T03:00:00Z")).toEqual({ date: "2026-11-17", startTime: "00:00" })
  expect(saoPauloInputsToIso("2026-11-17", "00:00")).toBe("2026-11-17T03:00:00.000Z")
})
