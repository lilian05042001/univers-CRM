// Headerele de securitate ale aplicației (folosite în next.config.ts).
// CSP fără nonce: Partial Prerendering (cacheComponents) nu e compatibil cu nonce-uri,
// iar scripturile inline ale Next sunt necesare; restul surselor sunt restrânse la aplicație + Supabase.

type Header = { key: string; value: string }

/** Originile Supabase (REST, Storage, Auth) și varianta WebSocket pentru Realtime. */
function supabaseOrigins(supabaseUrl: string | undefined): string[] {
  if (!supabaseUrl) return []
  const url = new URL(supabaseUrl)
  const ws = `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`
  return [url.origin, ws]
}

export function contentSecurityPolicy(options: {
  supabaseUrl: string | undefined
  isDev: boolean
}): string {
  const supabase = supabaseOrigins(options.supabaseUrl)
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(options.isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:", ...supabase.slice(0, 1)],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...supabase],
    "media-src": ["'self'", "blob:", ...supabase.slice(0, 1)],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  }
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`)
  // Local, Supabase rulează pe http: upgrade-insecure-requests l-ar bloca.
  if (!options.isDev && options.supabaseUrl?.startsWith("https:"))
    policy.push("upgrade-insecure-requests")
  return policy.join("; ")
}

export function securityHeaders(options: {
  supabaseUrl: string | undefined
  isDev: boolean
}): Header[] {
  const isHttps = options.supabaseUrl?.startsWith("https:") ?? false
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(!options.isDev && isHttps
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ]
      : []),
  ]
}
