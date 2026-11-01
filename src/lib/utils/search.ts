/**
 * Aceeași normalizare ca private.search_norm() din SQL: lowercase, fără diacritice.
 * „Țurcan” și „turcan” devin identice.
 */
export function normalizeSearch(value: string): string {
  return stripDiacritics(value).toLowerCase().trim()
}

/** „Ștefan Țurcan” → „Stefan Turcan” (\p{M} = semnele diacritice combinate după NFD). */
export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "")
}

/**
 * Identificator tehnic din text („Câmp special” → „camp_special_1a2b”), cu sufix aleator
 * pentru unicitate și prefix dacă nu începe cu literă.
 */
export function technicalKey(value: string, prefix: string, suffix: string): string {
  const base = stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30)
  return `${/^[a-z]/.test(base) ? base : `${prefix}_${base}`}_${suffix}`
}

/** Pattern ILIKE „conține”, cu caracterele speciale escapate. */
export function containsPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}
