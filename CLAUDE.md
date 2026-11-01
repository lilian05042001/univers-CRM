# Univers CRM — reguli de dezvoltare

CRM multi-tenant (Next.js + Supabase). Documentația completă: `docs/`.
- Arhitectură, structură, securitate, dependențe, riscuri: `docs/ARCHITECTURE.md`
- Schema DB: `docs/DATABASE.md` · Module: `docs/MODULES.md` · Plan: `docs/ROADMAP.md`

Decizii: monedă implicită MDL · Supabase local (Docker) pentru dezvoltare · limbă implicită română.

## Comenzi
`npm run dev` · `build` · `lint` · `typecheck` · `test` (Vitest) · `test:e2e` (Playwright) · `format`

## Particularități stack
- Next.js 16.4 cu **Cache Components**: API-urile modificate față de versiunile vechi — citește ghidul din `node_modules/next/dist/docs/` înainte de cod nou (vezi `AGENTS.md`). Citirile de sesiune/cookie stau în `<Suspense>`.
- shadcn/ui: componentele din `src/components/ui` se adaugă cu `npx shadcn@4.23.0 add <nume>`; nu se editează decât pentru bug-uri. `CommandDialog` necesită `<Command>` în interior.
- `cn` se importă din pachetul `cn`. Cod în stil fără `;`, ghilimele duble (Prettier).

## Reguli esențiale
1. **Lucrează pe etape** (`docs/ROADMAP.md`). Nu implementa module din etape viitoare. Așteaptă aprobarea la finalul fiecărei etape.
2. **Fiecare tabel de business are `organization_id`** + RLS activ. Nicio excepție. Testează RLS la fiecare tabel nou.
3. **Cheia `service_role` doar în `src/lib/supabase/admin.ts`** (`import 'server-only'`), folosită exclusiv în webhooks/cron. Niciodată în client, niciodată prefix `NEXT_PUBLIC_`.
4. **Mutațiile trec prin Server Actions / Route Handlers** cu: validare Zod → `requirePermission()` → acces date. RLS este a doua linie de apărare, nu singura.
5. **Schema se schimbă doar prin migrații** în `supabase/migrations/` (niciodată editare manuală în dashboard). Regenerează tipurile după migrare: `npm run db:types`.
6. **Cod pe module**: `src/modules/<modul>/{components,actions,queries,schemas,types,hooks}`. Componente UI generice în `src/components/`. Fără logică duplicată între module.
7. **Texte UI numai prin i18n** (`messages/ro.json`; en/ru ulterior). Fără stringuri hardcodate în componente.
8. **Fișiere mici** (orientativ < 300 linii). Server Components implicit; `"use client"` doar unde e nevoie de interactivitate.
9. **Dependențe noi doar cu justificare**; verifică lista aprobată din `docs/ARCHITECTURE.md` §8.
10. **Testele**: rulează doar cele relevante modificării (`npm run test -- <cale>`); E2E Playwright doar pentru fluxurile atinse.
11. Fără secrete în cod. Variabile în `.env.local` (necomis); șablon în `.env.example`.
12. Raportare concisă: ce s-a schimbat, ce teste au rulat și rezultatul.
