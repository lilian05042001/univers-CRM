/** Rute accesibile fără autentificare. */
export const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/auth", "/invite"] as const

/** Rute care nu au sens pentru un utilizator deja autentificat. */
export const GUEST_ONLY_PATHS = ["/login", "/register", "/forgot-password"] as const

export function matchesPath(pathname: string, paths: readonly string[]): boolean {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Acceptă doar căi relative interne, pentru a preveni open redirect. */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback
  }
  return next
}
