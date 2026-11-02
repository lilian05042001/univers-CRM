import type { StatusTone } from "@/components/shared/status-badge"

import type { RunStatus } from "../schemas"

export const RUN_TONES: Record<RunStatus, StatusTone> = {
  success: "success",
  skipped: "neutral",
  failed: "danger",
  running: "info",
}
