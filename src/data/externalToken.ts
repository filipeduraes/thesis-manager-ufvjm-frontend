/** Prefixo fixo dos tokens de membros externos de banca (mesmo valor do backend). */
export const EXTERNAL_TOKEN_PREFIX = "UFVJM"

const GROUP_SIZE = 4
const GROUP_COUNT = 4
const CODE_LENGTH = GROUP_SIZE * GROUP_COUNT

/**
 * Normalizes what the user typed or pasted into the grouped code (`ABCD-EFGH-IJKL-MNPQ`).
 *
 * Accepts the full token (`UFVJM-ABCD-…`, with or without dashes/spaces), lowercase and
 * stray separators. A leading `UFVJM` is always treated as the prefix, because people
 * type or paste the token as it appears in the e-mail; the odds of a real code starting
 * with those five letters are about 1 in 33 million (32 symbols, 5 positions).
 */
export function formatExternalTokenCode(rawValue: string): string {
  const alphanumeric = rawValue.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const code = alphanumeric.startsWith(EXTERNAL_TOKEN_PREFIX)
    ? alphanumeric.slice(EXTERNAL_TOKEN_PREFIX.length)
    : alphanumeric
  const limited = code.slice(0, CODE_LENGTH)
  const groups: string[] = []
  for (let index = 0; index < limited.length; index += GROUP_SIZE) {
    groups.push(limited.slice(index, index + GROUP_SIZE))
  }
  return groups.join("-")
}

/** Whether the grouped code has every character (the server still validates it). */
export function isExternalTokenComplete(code: string): boolean {
  return code.replace(/-/g, "").length === CODE_LENGTH
}

/** Builds the value sent to `POST /auth/external-token` from the grouped code. */
export function buildExternalToken(code: string): string {
  return `${EXTERNAL_TOKEN_PREFIX}-${code}`
}
