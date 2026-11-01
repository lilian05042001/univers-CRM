"use client"

import { useSyncExternalStore } from "react"

/**
 * Textul de căutare tastat dar încă netrimis în URL, per pagină.
 * Next remontează pagina la orice schimbare a parametrilor din URL (ex. închiderea unui dialog)
 * și poate pregăti noua instanță înainte ca utilizatorul să termine de tastat. Ținând textul în
 * afara componentei, orice instanță afișează ultima valoare tastată.
 */
const drafts = new Map<string, string>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setSearchDraft(pathname: string, value: string | undefined) {
  if (value === undefined) drafts.delete(pathname)
  else drafts.set(pathname, value)
  for (const listener of listeners) listener()
}

export function useSearchDraft(pathname: string): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => drafts.get(pathname),
    () => undefined
  )
}
