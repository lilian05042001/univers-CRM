// Oglinda private.api_scopes() (supabase/migrations/*_import_api.sql).
export const API_SCOPES = ["contacts:read", "contacts:write", "leads:read", "leads:write"] as const
export type ApiScope = (typeof API_SCOPES)[number]

/** Prefixul cheilor API („ucrm_…”); primele caractere rămân vizibile în listă. */
export const API_KEY_PREFIX = "ucrm"
export const API_KEY_VISIBLE_CHARS = 12
