import type { CustomFieldDef } from "@/modules/crm-config/types"

export const IMPORT_ENTITIES = ["contacts", "companies"] as const
export type ImportEntity = (typeof IMPORT_ENTITIES)[number]

export const IMPORT_FIELDS = {
  contacts: [
    "first_name",
    "last_name",
    "full_name",
    "phone",
    "email",
    "company",
    "position",
    "source",
    "owner",
    "tags",
    "city",
    "street",
  ],
  companies: ["name", "industry", "phone", "email", "website", "owner", "tags", "city", "street"],
} as const satisfies Record<ImportEntity, readonly string[]>

/** Câmpuri care pot primi mai multe coloane (valorile se unesc) și mai multe valori separate prin virgulă. */
export const MULTI_VALUE_FIELDS: ReadonlySet<string> = new Set(["phone", "email", "tags"])

export const CUSTOM_PREFIX = "custom."

/** Limitele unui import (fișierul e citit în browser și trimis pe loturi). */
export const IMPORT_LIMITS = { maxRows: 50_000, maxFileBytes: 20 * 1024 * 1024, batchSize: 500 }

/** Denumiri uzuale ale coloanelor (pe lângă eticheta din interfață), pentru maparea automată. */
const ALIASES: Record<ImportEntity, Record<string, string[]>> = {
  contacts: {
    first_name: ["prenume", "first name", "firstname", "given name", "имя"],
    last_name: ["nume de familie", "last name", "lastname", "surname", "family name", "фамилия"],
    full_name: ["nume", "nume complet", "name", "full name", "contact", "фио", "имя и фамилия"],
    phone: ["telefon", "tel", "mobil", "phone", "mobile", "phone number", "телефон"],
    email: ["e-mail", "email", "mail", "почта"],
    company: ["companie", "firma", "company", "organization", "компания"],
    position: ["functie", "post", "position", "job title", "title", "должность"],
    source: ["sursa", "source", "источник"],
    owner: ["responsabil", "owner", "responsible", "ответственный"],
    tags: ["etichete", "tags", "теги"],
    city: ["oras", "localitate", "city", "город"],
    street: ["adresa", "strada", "street", "address", "адрес"],
  },
  companies: {
    name: ["denumire", "nume", "companie", "company", "name", "название"],
    industry: ["domeniu", "industrie", "industry", "отрасль"],
    phone: ["telefon", "tel", "phone", "телефон"],
    email: ["e-mail", "email", "mail", "почта"],
    website: ["site", "website", "web", "url", "сайт"],
    owner: ["responsabil", "owner", "responsible", "ответственный"],
    tags: ["etichete", "tags", "теги"],
    city: ["oras", "localitate", "city", "город"],
    street: ["adresa", "strada", "street", "address", "адрес"],
  },
}

/** Antet normalizat: fără diacritice, majuscule, separatori sau text între paranteze. */
export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[_\-.:/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export type FieldCandidate = { key: string; labels: string[] }

/** Câmpurile disponibile pentru mapare (inclusiv câmpurile personalizate), cu etichetele de recunoaștere. */
export function importCandidates(
  entity: ImportEntity,
  label: (key: string) => string,
  customFields: CustomFieldDef[]
): FieldCandidate[] {
  return [
    ...IMPORT_FIELDS[entity].map((key) => ({
      key,
      labels: [label(key), key, ...(ALIASES[entity][key] ?? [])],
    })),
    ...customFields.map((def) => ({
      key: `${CUSTOM_PREFIX}${def.key}`,
      labels: [def.label, def.key],
    })),
  ]
}

/**
 * Maparea automată: fiecare coloană primește câmpul cu o etichetă identică (după normalizare).
 * Un câmp simplu se mapează o singură dată; telefoanele, e-mailurile și etichetele pot veni din mai multe coloane.
 */
export function autoMap(headers: string[], candidates: FieldCandidate[]): string[] {
  const index = new Map<string, string>()
  for (const candidate of candidates) {
    for (const label of candidate.labels) {
      const key = normalizeHeader(label)
      if (key && !index.has(key)) index.set(key, candidate.key)
    }
  }
  const used = new Set<string>()
  return headers.map((header) => {
    const field = index.get(normalizeHeader(header))
    if (!field || (used.has(field) && !MULTI_VALUE_FIELDS.has(field))) return ""
    used.add(field)
    return field
  })
}

/** Cheia i18n a erorii de mapare, sau null dacă maparea e completă. */
export function mappingError(entity: ImportEntity, mapping: string[]): string | null {
  const mapped = new Set(mapping.filter(Boolean))
  if (entity === "contacts") {
    if (!["first_name", "last_name", "full_name"].some((f) => mapped.has(f)))
      return "importExport.mapping.needName"
  } else if (!mapped.has("name")) {
    return "importExport.mapping.needCompanyName"
  }
  const single = mapping.filter((f) => f && !MULTI_VALUE_FIELDS.has(f))
  return new Set(single).size === single.length ? null : "importExport.mapping.duplicate"
}
