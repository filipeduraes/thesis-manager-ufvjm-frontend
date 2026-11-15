import { expect, test } from "@jest/globals"
import {
  draftToScheduleInput,
  EMPTY_SCHEDULE_DRAFT,
  expectedEnd,
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
