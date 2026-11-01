"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useTransition } from "react"

/**
 * Starea listelor (filtre, sortare, pagină, înregistrarea deschisă) trăiește în URL:
 * link-uri partajabile și back/forward corect.
 */
export function useListNavigation() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const setParams = useCallback(
    (updates: Record<string, string | null>, options: { resetPage?: boolean } = {}) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key)
        else next.set(key, value)
      }
      if (options.resetPage ?? true) next.delete("page")
      const query = next.toString()
      startTransition(() =>
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
      )
    },
    [pathname, router, searchParams]
  )

  return { searchParams, setParams, pending }
}
