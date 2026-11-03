# Univers CRM — Producție: deploy, backup, checklist

Arhitectura de producție: **Vercel** (aplicația Next.js, regiunea `fra1`) + **Supabase cloud** (Postgres, Auth, Storage, Realtime, pg_cron; regiunea `eu-central-1`, Frankfurt — aproape de Vercel și de utilizatorii din MD/RO).

## 1. Supabase (o singură dată)

1. Creează proiectul în regiunea **eu-central-1**, plan **Pro** (backup zilnic 7 zile; PITR opțional). Salvează parola bazei de date.
2. Leagă repo-ul și aplică migrațiile (seed-ul **nu** se aplică în producție):
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. Secretele worker-ului de automatizări în Vault (SQL Editor). `CRON_SECRET` = un șir aleator de ≥ 32 de caractere, identic cu cel din Vercel:
   ```sql
   select vault.create_secret('https://<domeniu>/api/jobs', 'jobs_url', 'Worker automatizări');
   select vault.create_secret('<CRON_SECRET>', 'cron_secret', 'Secretul joburilor');
   ```
4. **Authentication → URL Configuration**: Site URL `https://<domeniu>`; Redirect URLs `https://<domeniu>/**`.
5. **Authentication → Providers → Email**: confirmarea e-mailului **activă**; parola minimum 8 caractere, litere + cifre (ca în `supabase/config.toml`).
6. **Authentication → SMTP**: un furnizor de e-mail (Resend, Postmark, SES…) cu domeniul companiei — serverul implicit Supabase trimite doar câteva e-mailuri pe oră.
7. **Database → Extensions**: `pg_cron`, `pg_net` sunt create de migrații; verifică în **Integrations → Cron** joburile `automation-worker`, `automation-time-events`, `task-notifications`, `domain-events-cleanup`, `rate-limits-cleanup`.
8. **API → Data API**: doar schemele `public` și `graphql_public` expuse (schema `private` rămâne internă).

## 2. Vercel

1. Importă repo-ul GitHub; framework Next.js (detectat), regiunea din `vercel.json`.
2. Variabile de mediu (Production + Preview):

   | Variabilă | Valoare |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | cheia publishable (Settings → API Keys) |
   | `SUPABASE_SECRET_KEY` | cheia secret — **doar server**, niciodată cu prefix `NEXT_PUBLIC_` |
   | `NEXT_PUBLIC_APP_URL` | `https://<domeniu>` |
   | `CRON_SECRET` | același șir ca în Vault |

   `AUTH_RATE_LIMIT_PER_IP` **nu** se setează în producție (doar pentru testele E2E).
3. Domeniul propriu (Settings → Domains); HTTPS e automat. HSTS și `upgrade-insecure-requests` se activează singure când `NEXT_PUBLIC_SUPABASE_URL` e `https`.
4. După primul deploy: creează contul de administrator din `/register`, apoi compania din onboarding.

## 3. Backup și restaurare

- **Zilnic**: backup-urile automate Supabase (Pro: 7 zile; cu PITR: restaurare la minut).
- **Săptămânal**: workflow-ul `.github/workflows/backup.yml` (duminică 02:17 UTC, sau manual din Actions) face `supabase db dump` (roluri, schemă, date), criptează arhiva cu GPG (AES256) și o păstrează 30 de zile ca artefact. Secrete GitHub: `SUPABASE_DB_URL` (Settings → Database → Connection string, conexiune directă), `BACKUP_PASSPHRASE` (păstrată și în afara GitHub).
- Fișierele din Storage (atașamente) sunt incluse în backup-urile Supabase ale proiectului, nu în dump-ul logic.
- **Restaurare** dintr-un dump (într-un proiect nou sau local):
  ```bash
  gpg --decrypt univers-crm-AAAALLZZ.tar.gz.gpg > backup.tar.gz && tar -xzf backup.tar.gz
  psql "$DB_URL" -f backup/roles.sql
  psql "$DB_URL" -f backup/schema.sql
  psql "$DB_URL" -c "set session_replication_role = replica" -f backup/data.sql
  ```
  Testează restaurarea o dată pe trimestru (într-un proiect separat).

## 4. CI

`.github/workflows/ci.yml`: la fiecare push / PR — format, lint, typecheck, Vitest; apoi Supabase local în CI (migrații + seed), pgTAP și Playwright. Raportul Playwright se păstrează 7 zile dacă testele eșuează.

## 5. Checklist producție

**Securitate**
- [x] RLS activ pe toate tabelele, `organization_id` pe toate tabelele de business — verificat automat (`10_security.test.sql`)
- [x] Fără drepturi pentru `anon`; funcțiile `security definer` au `search_path` fixat (test automat)
- [x] `service_role` doar pe server (`src/lib/supabase/admin.ts`, `server-only`), granturi explicite, minime
- [x] Headere: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS (prod)
- [x] Limitarea cererilor: autentificare (IP + e-mail), API public (per cheie), webhooks (per canal)
- [x] Chei API / webhook / invitații stocate doar ca hash SHA-256, afișate o singură dată
- [x] CSV: protecție la injecția de formule; nume de fișiere ASCII-safe
- [ ] Confirmarea e-mailului activă și SMTP propriu în Supabase (pas manual, §1.5–1.6)
- [ ] `CRON_SECRET` și `SUPABASE_SECRET_KEY` setate doar în Vercel (pas manual, §2)

**Performanță**
- [x] Politicile RLS evaluează datele utilizatorului o dată per interogare (10 000 de contacte: `count` 1,8 s → 3 ms)
- [x] Import 10 000 de contacte ≈ 19 s, timp constant pe lot (`plan_cache_mode`, `ANALYZE` periodic)
- [x] Indexuri pe `(organization_id, …)` pentru liste, căutare (trigram), rapoarte, duplicate
- [x] Worker-ul de automatizări finalizează în bloc evenimentele fără automatizări

**Calitate**
- [x] pgTAP, Vitest, Playwright (desktop + mobil + import în volum) trec local; CI configurat
- [x] Interfața în română, engleză, rusă (test: chei și parametri identici, mesaje ICU valide)

**Operare**
- [ ] Proiect Supabase Pro în `eu-central-1`, migrații aplicate (`db push`), Vault configurat (§1)
- [ ] Proiect Vercel, variabile de mediu, domeniu propriu (§2)
- [ ] Secretele GitHub pentru backup + o restaurare de probă (§3)
- [ ] Cont de administrator și compania creată pe producție
