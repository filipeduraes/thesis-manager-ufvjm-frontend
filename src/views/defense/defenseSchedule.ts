import type { DefenseData, ScheduleDefenseInput, UpdateDefenseInput } from "../../api/client"
import type { DefenseModalityCode, DefenseScheduleDraft } from "../../types"

export const DEFENSE_TIME_ZONE = "America/Sao_Paulo"
export const MAX_DURATION_MINUTES = 720
const MINUTES_PER_DAY = 24 * 60

/** Duration shortcuts shown next to the duration field. */
export const DURATION_PRESETS: ReadonlyArray<{ minutes: number; label: string }> = [
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1h" },
  { minutes: 90, label: "1h30" },
  { minutes: 120, label: "2h" },
]

export const EMPTY_SCHEDULE_DRAFT: DefenseScheduleDraft = {
  date: "",
  startTime: "",
  duration: "",
  modality: null,
  location: "",
  notes: "",
}

interface DateParts {
  year: number
  month: number
  day: number
}

interface TimeParts {
  hour: number
  minute: number
}

function parseDateInput(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

function parseTimeInput(value: string): TimeParts | null {
  const match = /^(\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

function twoDigits(value: number): string {
  return String(value).padStart(2, "0")
}

const SAO_PAULO_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: DEFENSE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

/** Reads the São Paulo wall-clock parts of an instant, independently of the browser time zone. */
function saoPauloParts(instant: Date): DateParts & TimeParts {
  const parts = SAO_PAULO_PARTS_FORMATTER.formatToParts(instant)
  const pick = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value)
  // Alguns motores ainda formatam meia-noite como "24" mesmo com h23.
  return { year: pick("year"), month: pick("month"), day: pick("day"), hour: pick("hour") % 24, minute: pick("minute") }
}

/**
 * Returns the UTC offset of São Paulo, in minutes, at the given instant (e.g. -180).
 *
 * Derived from wall-clock parts instead of `timeZoneName: "longOffset"`, which older
 * browsers reject.
 */
function saoPauloOffsetMinutes(instant: Date): number {
  const wall = saoPauloParts(instant)
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute)
  const instantToMinute = Math.floor(instant.getTime() / 60_000) * 60_000
  return Math.round((wallAsUtc - instantToMinute) / 60_000)
}

/** Parses the duration input; returns minutes when it is an integer from 1 to 720, else `null`. */
export function parseDurationMinutes(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const minutes = Number(value)
  return minutes >= 1 && minutes <= MAX_DURATION_MINUTES ? minutes : null
}

/**
 * Converts `<input type="date">` and `<input type="time">` values, read as São Paulo
 * wall-clock time, into an ISO 8601 UTC string. Returns `null` when either is invalid.
 */
export function saoPauloInputsToIso(dateValue: string, timeValue: string): string | null {
  const date = parseDateInput(dateValue)
  const time = parseTimeInput(timeValue)
  if (!date || !time) return null
  const wallClockAsUtc = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute)
  const offset = saoPauloOffsetMinutes(new Date(wallClockAsUtc))
  return new Date(wallClockAsUtc - offset * 60_000).toISOString()
}

/** Converts an ISO 8601 instant into São Paulo `YYYY-MM-DD` and `HH:MM` input values. */
export function isoToSaoPauloInputs(iso: string): { date: string; startTime: string } {
  const wall = saoPauloParts(new Date(iso))
  return {
    date: `${wall.year}-${twoDigits(wall.month)}-${twoDigits(wall.day)}`,
    startTime: `${twoDigits(wall.hour)}:${twoDigits(wall.minute)}`,
  }
}

/**
 * Computes the expected end time (`HH:MM`) from a start time and a duration.
 *
 * Returns `null` unless both are valid. `nextDay` is true when the end passes midnight.
 */
export function expectedEnd(startTime: string, duration: string): { time: string; nextDay: boolean } | null {
  const start = parseTimeInput(startTime)
  const minutes = parseDurationMinutes(duration)
  if (!start || minutes === null) return null
  const totalMinutes = start.hour * 60 + start.minute + minutes
  const minuteOfDay = totalMinutes % MINUTES_PER_DAY
  return {
    time: `${twoDigits(Math.floor(minuteOfDay / 60))}:${twoDigits(minuteOfDay % 60)}`,
    nextDay: totalMinutes >= MINUTES_PER_DAY,
  }
}

/** Formats a short schedule summary such as `16/11 · 17:00 às 19:00`; `null` when incomplete. */
export function scheduleSummary(draft: Pick<DefenseScheduleDraft, "date" | "startTime" | "duration">): string | null {
  const date = parseDateInput(draft.date)
  const end = expectedEnd(draft.startTime, draft.duration)
  if (!date || !end || !parseTimeInput(draft.startTime)) return null
  const nextDaySuffix = end.nextDay ? " (dia seguinte)" : ""
  return `${twoDigits(date.day)}/${twoDigits(date.month)} · ${draft.startTime.slice(0, 5)} às ${end.time}${nextDaySuffix}`
}

/** Builds the scheduling payload from a draft; `null` when a required field is missing or invalid. */
export function draftToScheduleInput(draft: DefenseScheduleDraft): ScheduleDefenseInput | null {
  const scheduledDatetime = saoPauloInputsToIso(draft.date, draft.startTime)
  const durationMinutes = parseDurationMinutes(draft.duration)
  if (!scheduledDatetime || durationMinutes === null || !draft.modality) return null
  return {
    scheduledDatetime,
    durationMinutes,
    modality: draft.modality,
    location: draft.location.trim(),
    notes: draft.notes.trim(),
  }
}

function toModalityCode(value: string): DefenseModalityCode | null {
  if (value === "IN_PERSON" || value === "REMOTE") return value
  return null
}

/** Prefills the editable fields from a defense returned by the API. */
export function defenseToDraft(defense: DefenseData): DefenseScheduleDraft {
  const { date, startTime } = isoToSaoPauloInputs(defense.scheduledDatetime)
  return {
    date,
    startTime,
    duration: String(defense.durationMinutes),
    modality: toModalityCode(defense.modality),
    location: defense.location,
    notes: defense.notes,
  }
}

/** Formats a duration in minutes as `45 min`, `2h`, or `1h30`. */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours}h` : `${hours}h${twoDigits(rest)}`
}

/**
 * Returns whether the ISO instant is still in the future.
 *
 * The backend starts a defense automatically once its time has passed, so a past start
 * would turn the new defense into IN_PROGRESS before it could be edited or cancelled.
 */
export function isFutureStart(iso: string, now: number = Date.now()): boolean {
  return new Date(iso).getTime() > now
}

/**
 * Returns only the fields of `next` that differ from `original`, or `null` when the
 * draft is invalid. Resending an unchanged `scheduledDatetime` would clear the
 * backend's `auto_start_suspended` flag, so unchanged fields are omitted.
 */
export function changedScheduleFields(original: DefenseScheduleDraft, next: DefenseScheduleDraft): UpdateDefenseInput | null {
  const payload = draftToScheduleInput(next)
  if (!payload) return null
  const changes: UpdateDefenseInput = {}
  if (original.date !== next.date || original.startTime !== next.startTime) {
    changes.scheduledDatetime = payload.scheduledDatetime
  }
  if (parseDurationMinutes(original.duration) !== payload.durationMinutes) changes.durationMinutes = payload.durationMinutes
  if (original.modality !== payload.modality) changes.modality = payload.modality
  if (original.location.trim() !== payload.location) changes.location = payload.location
  if (original.notes.trim() !== payload.notes) changes.notes = payload.notes
  return changes
}

/**
 * Formats the São Paulo start and expected end of a defense, e.g. `17:00 às 19:00`,
 * adding `(dia seguinte)` when it ends after midnight.
 */
export function formatDefenseTimeRange(iso: string, durationMinutes: number): string {
  const { startTime } = isoToSaoPauloInputs(iso)
  const end = expectedEnd(startTime, String(durationMinutes))
  if (!end) return startTime
  return `${startTime} às ${end.time}${end.nextDay ? " (dia seguinte)" : ""}`
}
