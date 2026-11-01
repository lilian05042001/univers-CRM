import "server-only"

import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

export const getProfile = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone")
    .eq("id", userId)
    .maybeSingle()
  if (error) throw error
  return data
})
