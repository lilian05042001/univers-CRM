export const FILES_BUCKET = "crm-files"
export const MAX_FILE_BYTES = 25 * 1024 * 1024

/** Extensii refuzate (executabile / scripturi care pot fi deschise din browser). */
const BLOCKED = /\.(exe|msi|bat|cmd|com|scr|ps1|vbs|js|mjs|html?|svg|jar|apk|sh|dll)$/i

export function isAllowedFile(name: string, size: number) {
  return size > 0 && size <= MAX_FILE_BYTES && !BLOCKED.test(name)
}

/** Calea în bucket: {organizație}/{entitate}/{id}/{uuid}-{nume curățat}. */
export function storagePath(
  organizationId: string,
  entity: string,
  recordId: string,
  fileName: string
) {
  const safe = fileName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w.-]+/g, "_")
    // Fără „..” (respins de registerFile ca path traversal) și fără punct la început.
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+/, "")
    .slice(-120)
  return `${organizationId}/${entity}/${recordId}/${crypto.randomUUID()}-${safe}`
}
