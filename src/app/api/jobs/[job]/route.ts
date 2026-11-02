import { timingSafeEqual } from "node:crypto"

import { processBatch } from "@/lib/automation-engine/engine"
import { createEngineStore } from "@/lib/automation-engine/store"

/** Timpul maxim al unei rulări (pg_cron o reia la fiecare 15 secunde). */
const BUDGET_MS = 20_000

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  const header = request.headers.get("authorization") ?? ""
  if (!secret) return false
  const a = Buffer.from(header)
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Joburi periodice apelate de pg_cron (pg_net) sau de un cron extern, cu `Authorization: Bearer CRON_SECRET`. */
export async function POST(request: Request, ctx: RouteContext<"/api/jobs/[job]">) {
  if (!authorized(request)) return Response.json({ error: "unauthorized" }, { status: 401 })
  const { job } = await ctx.params
  if (job !== "automations") return Response.json({ error: "unknown_job" }, { status: 404 })

  const store = createEngineStore()
  const started = Date.now()
  const total = {
    batches: 0,
    events: 0,
    runs: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    duplicates: 0,
    errors: 0,
  }
  while (Date.now() - started < BUDGET_MS) {
    const stats = await processBatch(store)
    total.batches++
    for (const key of Object.keys(stats) as (keyof typeof stats)[]) total[key] += stats[key]
    if (stats.events === 0) break
  }
  return Response.json(total)
}
