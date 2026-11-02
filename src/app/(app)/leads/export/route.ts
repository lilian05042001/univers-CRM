import { exportResponse } from "@/modules/import-export/export"

/** Exportul CSV al listei, cu filtrele din URL (necesită data.export). */
export function GET(request: Request) {
  return exportResponse("leads", request)
}
