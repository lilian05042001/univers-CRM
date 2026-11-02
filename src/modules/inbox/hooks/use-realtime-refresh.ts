"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

import { getBrowserClient } from "@/lib/supabase/client"

/**
 * Reîncarcă datele paginii (Server Components) la modificări în tabelul dat, prin Supabase Realtime.
 * RLS se aplică și aici: utilizatorul primește doar evenimentele rândurilor pe care le vede.
 */
export function useRealtimeRefresh(
  channelName: string,
  table: "conversations" | "messages",
  filter: string,
  onChange?: () => void
) {
  const router = useRouter()
  const callback = useRef(onChange)
  useEffect(() => {
    callback.current = onChange
  })

  useEffect(() => {
    const supabase = getBrowserClient()
    let timer: ReturnType<typeof setTimeout> | undefined
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table, filter }, () => {
        // Mai multe evenimente apropiate (mesaj + actualizarea conversației) → o singură reîncărcare.
        clearTimeout(timer)
        timer = setTimeout(() => {
          callback.current?.()
          router.refresh()
        }, 250)
      })
      .subscribe()
    return () => {
      clearTimeout(timer)
      void supabase.removeChannel(channel)
    }
  }, [channelName, table, filter, router])
}
