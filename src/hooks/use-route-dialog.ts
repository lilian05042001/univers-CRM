"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * Dialog de editare deschis prin URL (`?open=<id|new>`, încărcat pe server).
 *
 * Închiderea folosește `history.replaceState` (sincronizat de Next cu useSearchParams):
 * dialogul dispare instant, fără drum la server — altfel ar rămâne deschis și ar ține
 * focusul până la răspuns. După salvare, `router.refresh()` aduce datele noi.
 *
 * `open` se citește din URL, nu din starea componentei: Next 16 păstrează starea
 * paginilor vizitate, iar o stare locală „închis” ar împiedica redeschiderea.
 */
export function useRouteDialog() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const openParam = searchParams.get("open")

  function close(saved = false) {
    const next = new URLSearchParams(searchParams.toString())
    next.delete("open")
    const query = next.toString()
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname)
    if (saved) router.refresh()
  }

  return { openParam, close }
}
