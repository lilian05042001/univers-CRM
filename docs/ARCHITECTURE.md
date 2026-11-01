# Univers CRM — Arhitectură

## 1. Viziune de ansamblu

```
Browser (React 19, Next.js App Router)
   │  Server Components (citiri) · Server Actions (mutații) · Supabase Realtime (inbox, notificări)
   ▼
Next.js server (Vercel)
   ├─ proxy.ts ............ refresh sesiune, redirect neautentificați, locale
   ├─ Server Actions ...... Zod → requirePermission() → servicii → Supabase (cu JWT-ul utilizatorului)
   ├─ /api/webhooks/* ..... intrări de la canale externe (semnătură verificată, idempotent)
   ├─ /api/jobs/* ......... worker automatizări / notificări (apelat de pg_cron, protejat cu secret)
   └─ /api/v1/* ........... API public (chei API cu hash, scopes)
   ▼
Supabase
   ├─ Postgres + RLS ...... izolare pe organization_id, permisiuni pe rol
   ├─ Auth ................ email+parolă, magic link, invitații (OAuth Google opțional)
   ├─ Storage ............. fișiere pe calea {organization_id}/{entitate}/{id}/…, cu RLS
   ├─ Realtime ............ mesaje, conversații, notificări
   ├─ Vault ............... credențiale integrări (token-uri WhatsApp/Meta etc.)
   └─ pg_cron + pg_net .... declanșează worker-ul la 1 minut, scanări periodice (întârzieri, inactivitate)
```

**Principii**
- *Monolit modular*: o singură aplicație Next.js, împărțită pe module de domeniu cu granițe clare. Fără microservicii.
- *Baza de date este sursa adevărului*: integritate prin FK, CHECK, triggere; istoricul (etape, audit, timeline) e scris în aceeași tranzacție cu modificarea.
- *Apărare în profunzime*: verificare permisiuni în server + RLS în Postgres.
- *Outbox de evenimente*: orice modificare relevantă scrie un `domain_event`; automatizările, notificările și (ulterior) webhooks externe consumă outbox-ul.

## 2. Multi-tenancy

- **Model**: schemă partajată, coloana `organization_id` pe fiecare tabel de business.
- **Integritate între tenanți**: FK-uri compuse `(organization_id, x_id) → x(organization_id, id)` pentru relațiile critice (lead→etapă, lead→contact etc.), astfel încât un rând nu poate referi date din altă organizație nici printr-un bug.
- **Organizația activă**: un utilizator poate aparține mai multor organizații. RLS permite accesul doar la organizațiile în care are `membership` activ; organizația curentă este aleasă în UI și păstrată într-un cookie, iar toate interogările filtrează explicit după ea. Comutarea nu necesită reemiterea JWT-ului.
- **Funcții helper RLS** (`security definer`, `stable`, schemă `private`): `is_member(org)`, `has_perm(org, perm)`, `lead_scope(org)` → `all|team|own`, `user_team_ids(org)`.

## 3. Strategia de autentificare și securitate

| Aspect | Decizie |
|---|---|
| Autentificare | Supabase Auth; sesiune în cookie-uri HTTP-only prin `@supabase/ssr`; `getUser()` (nu `getSession()`) pe server |
| Onboarding | Înregistrare → creare organizație (RPC atomic: org + rol Admin + membership + pipeline implicit + surse) |
| Invitații | token aleator de 256 biți, stocat doar ca hash SHA-256, expirare 7 zile, rol + echipă predefinite; acceptarea verifică că e-mailul contului = e-mailul invitației. Link-ul se afișează o singură dată (trimiterea pe e-mail vine cu integrarea de e-mail, Etapa 11) |
| Roluri | Administrator, Manager, Agent (sistem, nemodificabile ca cheie) + roluri personalizate |
| Permisiuni | chei text pe rol; catalogul unic e `private.permission_catalog()` (SQL), oglindit în `src/modules/auth/permissions.ts` (test automat de sincronizare). Vizibilitate: `crm.view.all` / `crm.view.team` / implicit doar proprii. Rolul `admin` are implicit totul și nu poate fi editat |
| Erori din DB | `raise exception '<cod>'` → `errors.db.<cod>` în `messages/*.json` (listă în `src/lib/actions/action.ts`) |
| Vizibilitate date | Admin: toată organizația · Manager: echipele sale · Agent: înregistrările atribuite lui (configurabil per rol) |
| Server | wrapper `action(schema, perm, handler)` pentru fiecare Server Action: validare Zod, verificare permisiune, mapare erori |
| RLS | activ pe toate tabelele; politici separate SELECT/INSERT/UPDATE/DELETE; teste pgTAP |
| service_role | doar `src/lib/supabase/admin.ts` + `server-only`; folosit de webhooks, cron, API public |
| Secrete integrări | Supabase Vault; în tabel se păstrează doar referința |
| Chei API | afișate o singură dată, stocate ca SHA-256, cu prefix vizibil și scopes |
| Webhooks | verificare semnătură (HMAC/provider), tabel `webhook_events` cu cheie unică pentru idempotență |
| Audit | trigger generic pe tabelele sensibile → `audit_log` (actor, acțiune, old/new jsonb) |
| Date personale (GDPR) | soft-delete + ștergere definitivă la cerere, export date contact, acces minim, fără date personale în loguri |
| Aplicație | CSP și headere de securitate, rate-limit pe login/API/webhooks, validare upload (tip, mărime) |
| Ștergeri | soft-delete (`deleted_at`) pentru lead-uri/contacte/companii; ștergerea definitivă doar Admin |

## 4. Structura directoarelor

```
univers-crm/
├─ CLAUDE.md
├─ docs/                          ARCHITECTURE, DATABASE, MODULES, ROADMAP
├─ messages/                      ro.json (implicit), en.json, ru.json
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/                 0001_core_tenancy.sql, 0002_crm_config.sql, … (versionate)
│  ├─ tests/                      teste pgTAP pentru RLS
│  └─ seed.sql                    date demo doar pentru dezvoltare locală
├─ public/
├─ src/
│  ├─ proxy.ts                    sesiune + protecție rute + locale (fost middleware.ts)
│  ├─ app/
│  │  ├─ (auth)/                  login, register, forgot-password, invite/[token]
│  │  ├─ (app)/                   layout cu sidebar + topbar
│  │  │  ├─ dashboard/
│  │  │  ├─ leads/                listă · [id]/ (fișa lead-ului)
│  │  │  ├─ pipeline/             kanban · ?pipeline=
│  │  │  ├─ contacts/             listă · [id]/
│  │  │  ├─ companies/            listă · [id]/
│  │  │  ├─ inbox/                [conversationId]/
│  │  │  ├─ tasks/
│  │  │  ├─ calendar/
│  │  │  ├─ automations/          listă · [id]/ (editor) · runs/
│  │  │  ├─ reports/              [report]/
│  │  │  ├─ team/
│  │  │  └─ settings/             company, users, teams, roles, pipelines, tags, fields,
│  │  │                           sources, task-types, notifications, integrations, api, import-export
│  │  ├─ api/
│  │  │  ├─ webhooks/[provider]/route.ts
│  │  │  ├─ jobs/[job]/route.ts
│  │  │  └─ v1/…                  API public
│  │  └─ layout.tsx, globals.css
│  ├─ components/
│  │  ├─ ui/                      primitive shadcn/ui (button, dialog, sheet, table, …)
│  │  ├─ shared/                  DataTable, FilterBar, StatusBadge, EntitySheet, EmptyState,
│  │  │                           PageHeader, ConfirmDialog, UserAvatar, DateRangePicker, FormField
│  │  └─ layout/                  AppSidebar, Topbar, GlobalSearch, NotificationBell, OrgSwitcher
│  ├─ modules/                    câte un director pe domeniu:
│  │  │                           auth, organizations, team, leads, pipelines, contacts, companies,
│  │  │                           inbox, tasks, calendar, automations, notifications, reports,
│  │  │                           dashboard, settings, integrations, import-export, search
│  │  └─ <modul>/
│  │     ├─ components/           componente specifice modulului
│  │     ├─ actions.ts            Server Actions (mutații)
│  │     ├─ queries.ts            citiri (server)
│  │     ├─ schemas.ts            scheme Zod (partajate client/server)
│  │     ├─ types.ts
│  │     ├─ hooks/                hook-uri client
│  │     └─ services/             logică de domeniu reutilizabilă (ex. moveLeadToStage)
│  ├─ lib/
│  │  ├─ supabase/                server.ts, client.ts, admin.ts (server-only), database.types.ts
│  │  ├─ auth/                    getCurrentUser, getActiveOrg, requirePermission
│  │  ├─ actions/                 wrapper `action()` + tipul Result<T>
│  │  ├─ i18n/                    configurare next-intl
│  │  ├─ automation-engine/       evaluare condiții, executori de acțiuni, dedupe
│  │  ├─ channels/                interfața ChannelAdapter + adaptoare (internal, email, whatsapp…)
│  │  └─ utils/                   date, bani, telefon (normalizare E.164), formatare
│  └─ config/                     navigație, constante, permisiuni
├─ tests/
│  ├─ unit/                       Vitest (scheme, servicii, motor automatizări)
│  └─ e2e/                        Playwright (fluxuri critice)
├─ .env.example
├─ next.config.ts, tsconfig.json, vitest.config.ts, playwright.config.ts
└─ package.json
```

## 5. Structura navigării și a interfeței

```
┌──────────┬───────────────────────────────────────────────────────────┐
│  LOGO    │ [🔍 Căutare globală  Ctrl+K]        [+ Nou] [🔔] [Org ▾] [👤] │
│──────────├───────────────────────────────────────────────────────────┤
│ Dashboard│ PageHeader: titlu · filtre · acțiuni                      │
│ Lead-uri │                                                           │
│ Pipeline │   Zonă de lucru (tabel / kanban / fișă / inbox 3 coloane) │
│ Contacte │                                                ┌─────────┐│
│ Companii │                                                │ Panou   ││
│ Inbox (3)│                                                │ lateral ││
│ Sarcini  │                                                │ (Sheet) ││
│ Calendar │                                                └─────────┘│
│ Automatiz│                                                           │
│ Rapoarte │                                                           │
│ Echipa   │                                                           │
│ Setări   │                                                           │
└──────────┴───────────────────────────────────────────────────────────┘
```

- **Sidebar** bleumarin (`#0F1B3D` aprox.), colapsabil; pe mobil devine drawer.
- **Topbar**: căutare globală (Ctrl+K, comandă unificată lead/contact/companie), buton „+ Nou”, notificări în timp real, comutator organizație, meniu profil.
- **Pattern-uri**: listă → click rând → *Sheet* lateral cu rezumat → „Deschide fișa” pentru pagina completă; crearea/editarea în *Dialog*; confirmări pentru acțiuni distructive.
- **Stare URL**: filtrele, sortarea, pagina și vizualizarea (kanban/listă) sunt în query string — link-uri partajabile, back/forward corect.
- **Design tokens** (CSS variables, Tailwind v4): `--primary` albastru, `--success` verde, `--warning` portocaliu, `--destructive` roșu, fundal `slate-50`, carduri albe, `radius` 0.5rem, umbre `sm`. Font: Inter (suport latin-ext + chirilic). Iconițe: lucide.
- **Responsive**: desktop complet; tabletă — sidebar colapsat, panouri ca overlay; telefon — liste ca carduri, kanban cu scroll orizontal pe coloană, inbox cu o coloană la un moment dat.

## 6. Date, performanță, stare

- Citiri în **Server Components**, paginare pe server (keyset pentru liste mari, offset pentru tabele administrative).
- Mutații prin **Server Actions** + `revalidatePath/revalidateTag`; update optimist pe kanban (dnd-kit) cu rollback la eroare.
- **Realtime** doar unde aduce valoare: inbox, notificări, (opțional) kanban.
- **Căutare**: `pg_trgm` + `unaccent` pe nume/telefon/email; RPC `global_search(org, q)` cu limită pe tip.
- **Rapoarte**: funcții SQL agregate (`security invoker`, respectă RLS) cu indexuri pe `(organization_id, created_at)`, `(organization_id, closed_at)`; materializare doar dacă apar probleme de volum.
- **Kanban**: încărcare per etapă (primele N carduri + „încarcă mai mult”), sume calculate în SQL.

## 7. Integrări (pregătire)

- Interfața `ChannelAdapter`: `verifyWebhook`, `parseInbound → NormalizedMessage`, `send(message)`, `getStatus`.
- Flux inbound: webhook → `webhook_events` (dedupe) → identificare contact prin `contact_identities` → conversație → mesaj → eveniment `message.received`.
- Flux outbound: mesaj creat cu `status=queued` → worker → adaptor → `sent/failed`.
- Etapa 8 livrează canalul **intern** (mesaje introduse manual / formular web) și infrastructura; conectarea reală la WhatsApp Cloud API, Meta (Instagram/Messenger), e-mail (IMAP/SMTP sau provider), telefonie se face ulterior, doar prin API-uri oficiale, cu credențiale reale ale companiei.

## 8. Dependențe necesare

Versiunile exacte se fixează la Etapa 1 după `npm view <pachet> version` (stabil, nu canary).

| Pachet | Scop |
|---|---|
| `next`, `react`, `react-dom`, `typescript` | framework |
| `tailwindcss` (v4), `@tailwindcss/postcss` | stiluri |
| shadcn/ui (CLI, cod copiat în proiect, stil `radix-nova`) + `radix-ui`, `class-variance-authority`, `cn` (înlocuiește clsx + tailwind-merge), `lucide-react`, `tw-animate-css`, `next-themes` (cerut de componenta sonner) | componente UI |
| `@supabase/supabase-js`, `@supabase/ssr` | client DB/Auth |
| `react-hook-form`, `zod`, `@hookform/resolvers` | formulare + validare |
| `@dnd-kit/core`, `@dnd-kit/sortable` | kanban, ordonare etape |
| `@tanstack/react-table` | tabele (headless, folosit de DataTable shadcn) |
| `recharts` | grafice (integrat cu componenta Chart din shadcn) |
| `next-intl` | i18n ro/en/ru |
| `date-fns` | date și intervale |
| `sonner` | toast-uri |
| `cmdk` | căutare globală Ctrl+K (componenta Command din shadcn) |
| `server-only` | protecție module server |
| `libphonenumber-js` | normalizare telefon pentru duplicate și identificare în inbox |
| `papaparse` (Etapa 11) | import/export CSV |
| dev: `vitest`, `@testing-library/react`, `jsdom`, `@playwright/test`, `supabase` (CLI), `eslint`, `prettier` | testare / tooling |

Nu sunt incluse: ORM (folosim tipuri generate de Supabase), state manager global, librării de animații, TanStack Query (de reevaluat doar dacă inbox-ul o cere).

## 9. Riscuri și decizii tehnice

| # | Risc / decizie | Abordare |
|---|---|---|
| R1 | Mediu de lucru | Node.js 26.13 LTS, npm 11.20, Git 2.56 instalate ✔ |
| R2 | **Decizie: Supabase local** (`supabase start`) — necesită Docker Desktop (încă neinstalat; blocant pentru Etapa 2) | Producția va fi un proiect Supabase cloud separat, alimentat doar prin migrații |
| R3 | Complexitatea și performanța RLS pe vizibilitate own/team/all | Funcții helper `stable` + indexuri pe `(organization_id, responsible_id)`, `(organization_id, team_id)`; teste pgTAP; `EXPLAIN` pe interogările kanban |
| R4 | Automatizări: execuții duplicate, bucle infinite | Outbox + `automation_runs` cu cheie unică `(automation_id, dedupe_key)`, `FOR UPDATE SKIP LOCKED`, limită de adâncime (o acțiune declanșată de automatizare nu re-declanșează aceeași automatizare), retry cu backoff |
| R5 | Cron pe Vercel Hobby e limitat (zilnic) | Planificare prin `pg_cron` + `pg_net` în Supabase care apelează `/api/jobs/*` cu secret |
| R6 | Integrări Meta/WhatsApp cer verificare business, aprobare app, șabloane de mesaje | Infrastructura internă întâi; integrarea reală ca proiect separat cu conturile companiei |
| R7 | Valoare pipeline vs. venit | **Pipeline estimat** = Σ `value` lead-uri `open` (opțional ponderat cu `probability` etapei). **Venit realizat** = Σ `won_amount` lead-uri `won` cu `closed_at` în perioadă. Nu se amestecă niciodată în același indicator |
| R8 | Statusul „Întârziată” al sarcinilor | Calculat (`due_at < now()` și status `new/in_progress`), nu stocat — evită joburi de sincronizare și inconsistențe |
| R9 | Monede | **Implicit MDL**; o monedă implicită per organizație, configurabilă; lead-urile păstrează `currency`; rapoartele agregă doar în moneda organizației (conversia valutară — în afara scopului inițial) |
| R10 | Câmpuri personalizate | Definiții în tabel + coloană `custom_fields jsonb` pe entitate, validare Zod dinamică pe server, index GIN. Evită EAV costisitor |
| R11 | Ordinea cardurilor în kanban | `position` numeric fracționar (inserare între două carduri fără renumerotare), rebalansare ocazională |
| R12 | Fusuri orare | Stocare `timestamptz` (UTC); afișare și filtre „Astăzi / luna curentă” în fusul orar al organizației |
| R13 | Volum `audit_log` / `domain_events` | Indexuri pe `(organization_id, created_at)`; curățare outbox procesat după 30 zile; partiționare doar la nevoie |
| R14 | Next.js 16.4: `proxy.ts`, **Cache Components** + Partial Prefetching active | Orice citire `cookies()`/sesiune trebuie să stea în spatele unui `<Suspense>` (altfel eroare de build); vezi `node_modules/next/dist/docs/01-app/02-guides/authentication-with-cache-components.md` |
