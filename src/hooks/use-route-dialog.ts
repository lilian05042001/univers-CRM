"use client"

import { useState } from "react"

/**
 * Dialog deschis prin URL (`?open=...`): se închide imediat pe client, iar `onClose`
 * actualizează URL-ul în paralel. Fără asta, dialogul ar rămâne deschis (și ar ține focusul)
 * până răspunde serverul la navigare.
 */
export function useRouteDialog(onClose: () => void) {
  const [open, setOpen] = useState(true)

  function close() {
    setOpen(false)
    onClose()
  }

  return { open, close, onOpenChange: (next: boolean) => !next && close() }
}
