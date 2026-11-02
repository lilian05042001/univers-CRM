import type { NextRequest } from "next/server"

import { updateSession } from "@/lib/supabase/proxy"

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Exclude fișierele statice, optimizarea imaginilor, resursele publice, webhook-urile, joburile
    // și API-ul public (fără sesiune; autentificate de adaptorul canalului / CRON_SECRET / cheia API).
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks/|api/jobs/|api/v1/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
