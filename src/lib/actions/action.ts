import "server-only"

import { unstable_rethrow } from "next/navigation"
import type { z } from "zod"

import {
  ForbiddenError,
  requirePermission,
  getOrgContext,
  type OrgContext,
} from "@/lib/auth/session"
import type { Permission } from "@/modules/auth/permissions"

import { fail, type ActionResult } from "./result"

// Coduri ridicate explicit din SQL (raise exception '<cod>'), traduse în errors.db.<cod>.
const DB_ERROR_CODES = new Set([
  "admin_only",
  "admin_permissions_locked",
  "assign_forbidden",
  "invalid_name",
  "invitation_email_mismatch",
  "invitation_invalid",
  "last_admin",
  "membership_immutable",
  "not_authenticated",
  "role_key_immutable",
  "system_role_create",
  "system_role_delete",
  "system_task_type_delete",
  "task_type_key_immutable",
])

type DbError = { code?: string; message?: string }

export function mapError(error: unknown): ActionResult<never> {
  if (error instanceof ForbiddenError) return fail("errors.forbidden")

  const dbError = error as DbError
  if (dbError?.message && DB_ERROR_CODES.has(dbError.message)) {
    return fail(`errors.db.${dbError.message}`)
  }
  switch (dbError?.code) {
    case "42501":
      return fail("errors.forbidden")
    case "23505":
      return fail("errors.duplicate")
    case "23503":
      return fail("errors.inUse")
  }

  console.error("[action] unexpected error", error)
  return fail("errors.unexpected")
}

function validationFailure(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".")
    fieldErrors[key] ??= issue.message
  }
  return fail("errors.validation", fieldErrors)
}

/** Server Action publică (ex. login): doar validare Zod + mapare erori. */
export function createAction<S extends z.ZodType, T>(
  schema: S,
  handler: (input: z.output<S>) => Promise<ActionResult<T>>
) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    const parsed = schema.safeParse(raw)
    if (!parsed.success) return validationFailure(parsed.error)
    try {
      return await handler(parsed.data)
    } catch (error) {
      unstable_rethrow(error)
      return mapError(error)
    }
  }
}

/**
 * Server Action în contextul organizației active:
 * validare Zod → verificare permisiune → handler. RLS rămâne a doua linie de apărare.
 */
export function createOrgAction<S extends z.ZodType, T>(
  options: { schema: S; permission?: Permission },
  handler: (input: z.output<S>, ctx: OrgContext) => Promise<ActionResult<T>>
) {
  return createAction(options.schema, async (input) => {
    const ctx = options.permission
      ? await requirePermission(options.permission)
      : await getOrgContext()
    return handler(input, ctx)
  })
}
