import { NextResponse, type NextRequest } from "next/server"

import { isLocale, LOCALE_COOKIE, resolveLocale } from "@/lib/i18n/config"
import { updateSession } from "@/lib/supabase/proxy"

const YEAR = 60 * 60 * 24 * 365

/**
 * Limba: cookie (ales în profil / pe pagina de autentificare) → Accept-Language → ro.
 * Calea se rescrie intern în /{limbă}/…, deci URL-urile rămân fără prefix.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // /en/contacts (link explicit cu limbă): limba devine preferința, URL-ul rămâne fără prefix.
  const [, first, ...rest] = pathname.split("/")
  if (isLocale(first)) {
    const url = request.nextUrl.clone()
    url.pathname = `/${rest.join("/")}`
    const redirect = NextResponse.redirect(url)
    redirect.cookies.set(LOCALE_COOKIE, first, { path: "/", maxAge: YEAR, sameSite: "lax" })
    return redirect
  }

  const locale = resolveLocale(
    request.cookies.get(LOCALE_COOKIE)?.value,
    request.headers.get("accept-language")
  )

  const target = request.nextUrl.clone()
  target.pathname = `/${locale}${pathname === "/" ? "" : pathname}`
  target.search = search
  return updateSession(request, target)
}

export const config = {
  matcher: [
    // Exclude fișierele statice, optimizarea imaginilor, resursele publice, webhook-urile, joburile
    // și API-ul public (fără sesiune; autentificate de adaptorul canalului / CRON_SECRET / cheia API).
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks/|api/jobs/|api/v1/|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
