import { expect, test } from "@jest/globals"
import {
  changedScheduleFields,
  draftToScheduleInput,
  EMPTY_SCHEDULE_DRAFT,
  expectedEnd,
  formatDuration,
  isFutureStart,
  isValidMeetingUrl,
  isoToSaoPauloInputs,
  locationError,
  parseDurationMinutes,
  saoPauloInputsToIso,
  REMOTE_LOCATION_ERROR,
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

const BASE_DRAFT = {
  date: "2026-11-16",
  startTime: "17:00",
  duration: "120",
  modality: "IN_PERSON" as const,
  location: "Auditório",
  notes: "",
}

test("detects start times that already passed", () => {
  const now = Date.parse("2026-11-16T19:59:00Z")
  expect(isFutureStart("2026-11-16T20:00:00.000Z", now)).toBe(true)
  expect(isFutureStart("2026-11-16T19:00:00.000Z", now)).toBe(false)
})

test("sends only the fields that changed when editing", () => {
  expect(changedScheduleFields(BASE_DRAFT, BASE_DRAFT)).toEqual({})
  expect(changedScheduleFields(BASE_DRAFT, { ...BASE_DRAFT, notes: "Levar projetor" })).toEqual({ notes: "Levar projetor" })
  expect(changedScheduleFields(BASE_DRAFT, { ...BASE_DRAFT, startTime: "18:00" })).toEqual({
    scheduledDatetime: "2026-11-16T21:00:00.000Z",
  })
  expect(changedScheduleFields(BASE_DRAFT, { ...BASE_DRAFT, duration: "" })).toBeNull()
})

test("accepts only http(s) meeting links", () => {
  expect(isValidMeetingUrl("https://meet.google.com/abc-defg-hij")).toBe(true)
  expect(isValidMeetingUrl("  http://conferenciaweb.rnp.br/sala/ufvjm ")).toBe(true)
  expect(isValidMeetingUrl("http://localhost:8080/sala")).toBe(true)
  expect(isValidMeetingUrl("meet.google.com/abc")).toBe(false)
  expect(isValidMeetingUrl("ftp://arquivos.ufvjm.edu.br")).toBe(false)
  expect(isValidMeetingUrl("https://meet")).toBe(false)
  expect(isValidMeetingUrl("https://meet.google.com/abc def")).toBe(false)
  expect(isValidMeetingUrl("")).toBe(false)
})

test("requires the link only for remote defenses", () => {
  expect(locationError({ modality: "REMOTE", location: "" })).toBe(REMOTE_LOCATION_ERROR)
  expect(locationError({ modality: "REMOTE", location: "Sala 10" })).toBe(REMOTE_LOCATION_ERROR)
  expect(locationError({ modality: "REMOTE", location: "https://meet.google.com/x" })).toBeNull()
  expect(locationError({ modality: "IN_PERSON", location: "" })).toBeNull()
  expect(locationError({ modality: null, location: "qualquer" })).toBeNull()
})
