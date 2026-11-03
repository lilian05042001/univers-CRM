import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { env } from "@/lib/env"
import { GUEST_ONLY_PATHS, PUBLIC_PATHS, matchesPath } from "@/lib/auth/routes"

/**
 * Reîmprospătează sesiunea Supabase și face redirecționările optimiste.
 * Verificarea reală a accesului rămâne în server (DAL + RLS).
 * `rewriteTo`: ruta internă (cu limba) care servește cererea; URL-ul din browser nu se schimbă.
 */
export async function updateSession(request: NextRequest, rewriteTo?: URL) {
  const forward = () =>
    rewriteTo ? NextResponse.rewrite(rewriteTo, { request }) : NextResponse.next({ request })
  let response = forward()

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = forward()
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value)
      },
    },
  })

  // Nu inserați cod între createServerClient și getClaims: riscă deconectări aleatorii.
  const { data } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(data?.claims)
  const { pathname, search } = request.nextUrl

  if (!isAuthenticated && !matchesPath(pathname, PUBLIC_PATHS)) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`)
    return redirectWithCookies(url, response)
  }

  if (isAuthenticated && matchesPath(pathname, GUEST_ONLY_PATHS)) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    url.search = ""
    return redirectWithCookies(url, response)
  }

  return response
}

function redirectWithCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url)
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie)
  return redirect
}
