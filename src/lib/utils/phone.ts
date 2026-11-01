import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js"

/**
 * Telefonul în format E.164 („069 123 456” → „+37369123456” pentru MD).
 * Dacă numărul nu poate fi interpretat, se păstrează textul introdus.
 */
export function normalizePhone(value: string, defaultCountry: CountryCode = "MD"): string {
  const trimmed = value.trim()
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry)
  return parsed?.isPossible() ? parsed.number : trimmed
}

/** Afișare lizibilă: „+37369123456” → „+373 69 123 456”. */
export function formatPhone(value: string): string {
  return parsePhoneNumberFromString(value)?.formatInternational() ?? value
}
