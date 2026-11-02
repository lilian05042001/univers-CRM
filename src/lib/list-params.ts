import { z } from "zod"

export const PAGE_SIZES = [25, 50, 100] as const

export type SearchParams = Record<string, string | string[] | undefined>

export type ListParams<S extends string> = {
  page: number
  pageSize: number
  sort: S
  dir: "asc" | "desc"
  q: string
  /** Valoarea unui filtru (primul element, dacă e repetat); "" dacă lipsește. */
  get: (key: string) => string
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""

/** Parametrii unei liste din URL (paginare, sortare, căutare, filtre), validați. */
export function parseListParams<S extends string>(
  searchParams: SearchParams,
  options: { sortKeys: readonly S[]; defaultSort: S; defaultDir?: "asc" | "desc" }
): ListParams<S> {
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10_000)
    .catch(1)
    .parse(first(searchParams.page) || 1)
  const pageSize = z.coerce
    .number()
    .refine((n) => (PAGE_SIZES as readonly number[]).includes(n))
    .catch(PAGE_SIZES[0])
    .parse(first(searchParams.size) || PAGE_SIZES[0])
  const sortParam = first(searchParams.sort)
  const sort = (options.sortKeys as readonly string[]).includes(sortParam)
    ? (sortParam as S)
    : options.defaultSort
  const dirParam = first(searchParams.dir)
  const dir = dirParam === "asc" || dirParam === "desc" ? dirParam : (options.defaultDir ?? "desc")

  return {
    page,
    pageSize,
    sort,
    dir,
    q: first(searchParams.q).slice(0, 100),
    get: (key) => first(searchParams[key]).slice(0, 100),
  }
}

/** Intervalul de rânduri pentru Supabase `.range(from, to)`. */
export function pageRange(params: { page: number; pageSize: number }) {
  const from = (params.page - 1) * params.pageSize
  return { from, to: from + params.pageSize - 1 }
}

export const isUuid = (v: string) => z.uuid().safeParse(v).success

/** Numărul maxim de rânduri într-un export CSV. */
export const EXPORT_LIMIT = 50_000
const EXPORT_PAGE = 1000

/** Toate rândurile unei liste filtrate (export), în pagini de 1000, cel mult EXPORT_LIMIT. */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => Promise<T[]>
): Promise<T[]> {
  const rows: T[] = []
  while (rows.length < EXPORT_LIMIT) {
    const batch = await page(rows.length, rows.length + EXPORT_PAGE - 1)
    rows.push(...batch)
    if (batch.length < EXPORT_PAGE) break
  }
  return rows.slice(0, EXPORT_LIMIT)
}
