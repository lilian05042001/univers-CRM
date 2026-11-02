// node:crypto: doar pe server (rutele API, Server Actions).
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

/** Cheie aleatoare (256 biți) cu prefix lizibil, ex. „whk_…”. Se afișează o singură dată. */
export function generateSecret(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString("base64url")}`
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

/** Compară cheia primită cu hash-ul stocat în timp constant. */
export function secretMatchesHash(secret: string, hash: string | null | undefined): boolean {
  if (!hash) return false
  const a = Buffer.from(sha256Hex(secret), "hex")
  const b = Buffer.from(hash, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}
