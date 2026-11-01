/** Rezultatul unei Server Action. `error` și valorile din `fieldErrors` sunt chei i18n. */
export type ActionResult<T = null> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> }

export function ok(): ActionResult<null>
export function ok<T>(data: T): ActionResult<T>
export function ok<T>(data?: T): ActionResult<T | null> {
  return { ok: true, data: data ?? null }
}

export function fail(
  error: string,
  fieldErrors?: Record<string, string>
): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  return { ok: false, error, fieldErrors }
}
