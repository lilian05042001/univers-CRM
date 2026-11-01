# Univers CRM — Plan etapizat

Fiecare etapă se încheie cu: teste relevante trecute, raport scurt, **aprobare** înainte de etapa următoare.

| Etapa | Conținut | Criteriu de finalizare |
|---|---|---|
| **0** ✅ | Analiză, arhitectură, schema DB, documentație, CLAUDE.md | Documentele din `docs/` aprobate |
| **1** ✅ | Instalare Node/Git, init Next.js + TS + Tailwind v4 + shadcn/ui, ESLint/Prettier, Vitest, Playwright, next-intl (ro), design tokens, layout aplicație (sidebar, topbar, pagini goale pentru cele 12 module), componente shared de bază, repo Git + GitHub | `npm run build` și `lint` trec; navigare completă responsive |
| **2** ✅ | Supabase (local/cloud), clienți server/browser/admin, `proxy.ts`, login/register/reset, onboarding organizație, invitații, roluri și permisiuni, `requirePermission`, comutator organizație, migrații tenancy + RLS + teste pgTAP | Un utilizator nu vede datele altei organizații (test automat) |
| **3** ✅ | Migrații pentru configurarea CRM și entitățile principale, triggere (`updated_at`, audit, stage history, activities, outbox), funcții helper RLS, tipuri generate, seed demo | `supabase db reset` rulează curat; teste RLS pe toate tabelele |
| **4** ✅ | Contacte, companii, lead-uri: CRUD, DataTable, filtre, căutare, paginare, duplicate, etichete, câmpuri personalizate, acțiuni în masă | E2E: creare contact → lead → filtrare |
| **5** ✅ | Pipeline: kanban dnd-kit, setări pipeline/etape (CRUD, ordonare, culori, etape finale), motiv pierdere / sumă câștig, reguli de atribuire | Mutarea persistă + apare în istoric |
| **6** ✅ | Fișe detaliate lead/contact/companie: secțiuni A–I, cronologie, note, fișiere (Storage), audit vizibil | E2E pe fișa lead-ului |
| **7** | Sarcini (listă, tipuri, statusuri, întârziate) + calendar zi/săpt/lună + notificări in-app pentru apropiate/întârziate | Notificare generată pentru sarcină întârziată |
| **8** | Inbox: canal intern, conversații, mesaje, note interne, atașamente, răspunsuri rapide, atribuire, realtime, interfața `ChannelAdapter` + endpoint webhooks idempotent | Mesaj intrat → contact identificat → conversație |
| **9** | Motor automatizări: outbox, worker (`/api/jobs`), pg_cron, editor UI, cele 6 scenarii, istoric execuții, dedupe, protecție la bucle | Teste unitare motor + test dedupe |
| **10** | Dashboard + rapoarte (funcții SQL, grafice Recharts, filtre perioadă, export CSV) | Cifrele corespund datelor seed (test) |
| **11** | Import/export CSV cu mapare câmpuri și raport erori, chei API + API public v1, pagina integrări | Import 10k contacte fără blocarea UI |
| **12** | Audit securitate (RLS, headere, rate-limit), performanță (EXPLAIN, indexuri), suite E2E complete, i18n en/ru, deploy Vercel + Supabase producție, backup | Checklist producție bifat |

## Decizii confirmate
- Produs: **Univers CRM** · Monedă implicită: **MDL** · Dezvoltare: **Supabase local** (Docker).

## De pregătit
- [x] Node.js LTS, Git
- [x] **Docker Desktop** (WSL 2)
- [ ] Cont GitHub (repo privat) — pentru push la finalul Etapei 1
- [ ] Cont Supabase cloud — doar la Etapa 12 (producție)
