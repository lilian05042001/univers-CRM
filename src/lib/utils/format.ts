/** Câmpurile text opționale se salvează ca NULL, nu ca șir gol. */
export function emptyToNull(value: string | null | undefined): string | null {
  return value ? value : null
}

/** Inițialele pentru avatar: „Ion Popescu” → „IP”, „ana@x.md” → „A”. */
export function initials(name: string): string {
  const parts = name.replace(/@.*/, "").trim().split(/\s+/).filter(Boolean)
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("")
}
