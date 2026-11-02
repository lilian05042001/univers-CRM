# Univers CRM — API public v1

REST + JSON pentru integrarea sistemelor externe (site, ERP, formulare). Datele aparțin organizației cheii API.

## Autentificare

Cheia se creează în **Setări → API** (drept necesar: „Chei API”) și se afișează o singură dată.

```
Authorization: Bearer ucrm_…
```

| Scope | Permite |
|---|---|
| `contacts:read` | `GET` contacte și companii |
| `contacts:write` | `POST` / `PATCH` / `DELETE` contacte și companii |
| `leads:read` | `GET` lead-uri și pipeline-uri |
| `leads:write` | `POST` / `PATCH` / `DELETE` lead-uri |

O cheie nu mai este valabilă dacă e revocată, a expirat sau autorul ei nu mai este membru activ al organizației.

## Convenții

- Adresa de bază: `https://<domeniu>/api/v1`.
- Liste: `?limit=` (1–100, implicit 50), `offset=`, `q=` (căutare după nume), `updated_since=` (ISO 8601, ex. `2026-11-01T00:00:00Z`). Ordine: cele mai noi întâi.
  Răspuns: `{ "data": [...], "pagination": { "total", "limit", "offset" } }`.
- O înregistrare: `{ "data": { ... } }`. Creare: `201`. Ștergere: `204` (ștergere logică, ca în aplicație).
- `PATCH` modifică doar câmpurile trimise; `null` golește un câmp. Listele (`phones`, `emails`, `tag_ids`, `contact_ids`) se înlocuiesc integral.
- Câmpurile necunoscute sunt respinse. Câmpurile personalizate (`custom_fields`) se validează după definițiile din **Setări → Câmpuri** (tip, opțiuni, obligatorii).
- Id-urile referite (companie, sursă, responsabil, echipă, etichete, etapă) trebuie să fie din aceeași organizație.

### Erori

```json
{ "error": { "code": "validation_failed", "fields": { "title": "required" } } }
```

| Status | `code` |
|---|---|
| 400 | `invalid_json` |
| 401 | `unauthorized` (cheie lipsă, greșită, revocată sau expirată) |
| 403 | `insufficient_scope` |
| 404 | `not_found` |
| 409 | `conflict` |
| 413 | `payload_too_large` (corp > 64 KB) |
| 422 | `validation_failed` (cu `fields`), `invalid_reference`, `invalid_value` |
| 500 | `internal_error` |

## Resurse

| Metodă | Resursă | Scope |
|---|---|---|
| `GET` / `POST` | `/contacts` | `contacts:read` / `contacts:write` |
| `GET` / `PATCH` / `DELETE` | `/contacts/{id}` | `contacts:read` / `contacts:write` |
| `GET` / `POST` | `/companies` | `contacts:read` / `contacts:write` |
| `GET` / `PATCH` / `DELETE` | `/companies/{id}` | `contacts:read` / `contacts:write` |
| `GET` / `POST` | `/leads` (filtre: `status=open\|won\|lost`, `pipeline_id=`) | `leads:read` / `leads:write` |
| `GET` / `PATCH` / `DELETE` | `/leads/{id}` | `leads:read` / `leads:write` |
| `GET` | `/pipelines` (cu etapele, pentru `pipeline_id` / `stage_id`) | `leads:read` |

### Contact

```json
{
  "first_name": "Ion", "last_name": "Popescu", "position": "Director",
  "company_id": null, "source_id": null, "owner_id": null,
  "phones": ["+37369123456"], "emails": ["ion@exemplu.md"],
  "address": { "city": "Chișinău", "street": "" },
  "tag_ids": [], "custom_fields": {}
}
```

Obligatoriu la creare: `first_name` sau `last_name`. Primul telefon / e-mail este cel principal; telefoanele se normalizează în format internațional (implicit MD). Răspunsul conține și `id`, `full_name`, `created_at`, `updated_at`.

### Companie

`name` (obligatoriu), `industry`, `phone`, `email`, `website` (URL complet), `owner_id`, `address`, `tag_ids`, `custom_fields`.

### Lead

```json
{
  "title": "Ofertă mobilier birou", "value": 15000, "currency": "MDL",
  "pipeline_id": null, "stage_id": null, "priority": "normal",
  "contact_ids": ["…"], "company_id": null, "source_id": null,
  "responsible_id": null, "team_id": null, "description": null,
  "loss_reason_id": null, "tag_ids": [], "custom_fields": {}
}
```

- Obligatoriu: `title`. Fără `stage_id`: prima etapă a pipeline-ului (implicit cel principal). Cu `stage_id`, etapa trebuie să fie în pipeline-ul lead-ului (la mutarea în alt pipeline trimite ambele).
- O etapă „pierdut” cere `loss_reason_id`. `status`, `won_amount`, `closed_at` se calculează din etapă (suma câștigată = `value`).
- `currency` implicită: moneda organizației. Fără `responsible_id`, se aplică regula de atribuire a pipeline-ului.
- Lead-urile create sau modificate prin API declanșează aceleași automatizări și apar în cronologie ca cele din aplicație.

## Exemplu

```bash
curl -X POST "https://<domeniu>/api/v1/leads" \
  -H "Authorization: Bearer ucrm_…" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Cerere de pe site", "value": 2500 }'
```
