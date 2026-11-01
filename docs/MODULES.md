# Univers CRM — Descrierea funcțională a modulelor

| # | Modul | Rută | Funcționalitate | Date principale |
|---|---|---|---|---|
| 1 | **Dashboard** | `/dashboard` | KPI: lead-uri noi / active / câștigate / pierdute, rată conversie, valoare pipeline (estimată), vânzări încheiate (realizate), sarcini restante și de azi, activitatea echipei. Grafice: evoluție vânzări, evoluție lead-uri, conversie pe etape, performanță angajați, surse. Flux activitate recentă. Filtru perioadă (azi, 7z, 30z, luna curentă, luna precedentă, personalizat). Totul calculat prin funcții SQL, respectând vizibilitatea rolului | leads, lead_stage_history, tasks, activities |
| 2 | **Lead-uri** | `/leads`, `/leads/[id]` | Listă tabelară: căutare, filtre avansate (pipeline, etapă, responsabil, echipă, sursă, etichete, prioritate, valoare, date, câmpuri personalizate), sortare, paginare, coloane configurabile, acțiuni în masă (atribuire, mutare etapă, etichete, ștergere, export) | leads, lead_contacts, tags |
| 3 | **Pipeline** | `/pipeline` | Kanban cu drag-and-drop între etape și în cadrul etapei; sumă și număr pe coloană; selector pipeline; filtre comune cu lista; la mutare în „Pierdut” se cere motivul, în „Câștigat” suma realizată. Mutarea se salvează în DB + `lead_stage_history` + `activities` | leads, pipeline_stages |
| 4 | **Fișa lead-ului** | `/leads/[id]` | Secțiuni: A. info generale, B. date client (contacte/companie), C. info comerciale, D. cronologie activități, E. conversații, F. sarcini, G. note, H. fișiere, I. istoric modificări (audit). Acțiuni rapide: notă, sarcină, schimbare responsabil, schimbare etapă | toate entitățile legate |
| 5 | **Contacte** | `/contacts`, `/contacts/[id]` | CRUD, multiple telefoane/e-mailuri/identități, companie, funcție, adresă, sursă, etichete, note; lead-uri și conversații asociate; cronologie. **Detectare duplicate** la creare/editare după telefon normalizat (E.164) și e-mail — avertizează și despre contactele invizibile utilizatorului, fără a le expune — cu unire (merge) care mută lead-urile, notele, sarcinile și fișierele | contacts, contact_identities |
| 6 | **Companii** | `/companies`, `/companies/[id]` | CRUD, domeniu, contacte, lead-uri asociate, istoric, duplicate după telefon/e-mail/denumire | companies |
| 7 | **Inbox** | `/inbox/[id]` | 3 coloane: listă conversații (filtre: status, atribuire, canal, etichete; căutare) · fir mesaje (trimise/primite, note interne, atașamente, răspunsuri rapide) · fișa clientului (contact, lead asociat, creare lead din conversație). Atribuire conversație, status open/pending/closed, necitite, realtime. Canal intern funcțional; arhitectură de adaptoare pentru WhatsApp/Instagram/Messenger/e-mail/telefonie | channels, conversations, messages |
| 8 | **Sarcini** | `/tasks` | Listă cu tab-uri (azi, întârziate, viitoare, finalizate), tipuri (apel, întâlnire, mesaj, e-mail, follow-up, generală), status, prioritate, legătură cu lead/contact, finalizare cu rezultat | tasks, task_types |
| 9 | **Calendar** | `/calendar` | Vizualizare zi / săptămână / lună a sarcinilor; drag pentru reprogramare; filtru pe utilizator/echipă | tasks |
| 10 | **Automatizări** | `/automations` | Listă, editor (declanșator → condiții → acțiuni), activare/dezactivare, istoric execuții cu erori. Exemplele cerute: atribuire la creare, sarcină la intrare în etapă, notificare termen, motiv pierdere, înregistrare rezultat câștig, reminder la inactivitate | automations, automation_runs, domain_events |
| 11 | **Rapoarte** | `/reports/[report]` | Lead-uri noi / câștigate / pierdute, conversie pe etape (funnel), vânzări pe perioadă / angajat / echipă, surse, activități realizate / restante, motive pierdere, durată medie ciclu vânzare. Filtre (perioadă, pipeline, echipă, angajat, sursă) + export CSV. Separare clară *pipeline estimat* vs *venit realizat* | funcții SQL de raportare |
| 12 | **Echipa** | `/team` | Membri, roluri, echipe, invitații, dezactivare, încărcare (lead-uri active / sarcini per om), performanță | memberships, teams, invitations |
| 13 | **Setări** | `/settings/*` | Companie, utilizatori, echipe, roluri și permisiuni, pipeline-uri și etape (ordonare dnd, culori, etape finale, reguli de atribuire), etichete, câmpuri personalizate, surse, tipuri de activități, motive pierdere, notificări, integrări (canale), chei API, import/export | tabelele de configurare |
| — | **Transversale** | — | Căutare globală (Ctrl+K), notificări în timp real (clopoțel + preferințe), comutator organizație, i18n, audit | notifications, audit_log |

## Matrice roluri (implicită, configurabilă)

| Capabilitate | Administrator | Manager | Agent |
|---|---|---|---|
| Vizibilitate lead-uri / contacte | toate | echipele sale | ale sale |
| Creare / editare lead-uri | ✔ | ✔ (echipă) | ✔ (proprii) |
| Ștergere lead-uri | ✔ | ✔ (echipă) | ✖ |
| Redistribuire lead-uri | ✔ | ✔ (echipă) | ✖ |
| Inbox | toate | echipă | atribuite + neatribuite |
| Rapoarte | toate | echipă | proprii (dashboard) |
| Export | ✔ | ✔ | ✖ |
| Automatizări, pipeline-uri, câmpuri | ✔ | citire | ✖ |
| Utilizatori, roluri, setări, API | ✔ | ✖ | ✖ |
