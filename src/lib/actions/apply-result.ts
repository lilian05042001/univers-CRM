import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form"

import type { ActionResult } from "./result"

/**
 * Aplică erorile de câmp ale unei Server Action pe formular.
 * Returnează cheia erorii generale (sau null dacă acțiunea a reușit).
 */
export function applyActionResult<T extends FieldValues>(
  form: UseFormReturn<T>,
  result: ActionResult<unknown>
): string | null {
  if (result.ok) return null
  for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
    form.setError(name as FieldPath<T>, { message })
  }
  return result.fieldErrors ? null : result.error
}
