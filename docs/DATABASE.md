# Univers CRM — Schema bazei de date

Convenții: PK `id uuid default gen_random_uuid()` (excepție: tabele de volum cu `bigint identity`); `created_at/updated_at timestamptz` (trigger `set_updated_at`); `organization_id` NOT NULL pe toate tabelele de business, cu FK spre `organizations` și `on delete cascade`; soft-delete `deleted_at` unde e menționat; enumerări ca tipuri Postgres `enum` sau `text + CHECK`; bani `numeric(14,2)`; RLS activ pe tot.

Legendă: `→` FK · `⇉` FK compus cu `organization_id` · `[U]` unic · `[I]` index.

## 1. Nucleu și tenancy

| Tabel | Coloane principale |
|---|---|
| `organizations` | name, slug [U], legal_name, fiscal_code, country, currency (default `'MDL'`), timezone, default_locale, logo_path, settings jsonb |
| `profiles` | id → auth.users (1:1), full_name, avatar_path, phone, locale |
| `roles` | organization_id, key, name, is_system, permissions text[] · [U] (organization_id, key) |
| `memberships` | organization_id, user_id → profiles, role_id ⇉ roles, status `active/invited/disabled`, title · [U] (organization_id, user_id) |
| `invitations` | organization_id, email, role_id ⇉, team_id ⇉, token_hash [U], expires_at, accepted_at, invited_by |
| `teams` | organization_id, name, manager_id → profiles |
| `team_members` | organization_id, team_id ⇉, user_id · PK (team_id, user_id) |

## 2. Configurare CRM

| Tabel | Coloane principale |
|---|---|
| `pipelines` | organization_id, name, is_default, position, archived_at |
| `pipeline_stages` | organization_id, pipeline_id ⇉, name, color, position, kind `open/won/lost`, probability 0–100 · CHECK: exact o etapă `won` și una `lost` per pipeline (trigger) |
| `assignment_rules` | organization_id, pipeline_id ⇉, strategy `round_robin/least_loaded/fixed`, config jsonb (utilizatori, echipă, ultimul atribuit), is_active |
| `lead_sources` | organization_id, name, channel `manual/web_form/whatsapp/instagram/messenger/email/phone/import/api/other`, is_active |
| `tags` | organization_id, name, color · [U] (organization_id, lower(name)) |
| `loss_reasons` | organization_id, name, position, is_active |
| `task_types` | organization_id, key `call/meeting/message/email/follow_up/general` sau personalizat, name, icon, is_system |
| `custom_field_definitions` | organization_id, entity `lead/contact/company`, key, label, type `text/number/date/select/multiselect/bool/url`, options jsonb, is_required, position · [U] (organization_id, entity, key) |

## 3. Entități CRM

**`companies`** — organization_id, name, industry, phone, email, website, address jsonb, owner_id, custom_fields jsonb, created_by, deleted_at · [I] trigram pe name, (organization_id, phone_normalized), (organization_id, lower(email))

**`contacts`** — organization_id, company_id ⇉ companies (N:1 — o companie are multe contacte), first_name, last_name, position, address jsonb, source_id ⇉, owner_id, custom_fields jsonb, created_by, deleted_at · [I] trigram pe nume complet

**`contact_identities`** — organization_id, contact_id ⇉, type `phone/email/whatsapp/instagram/messenger/telegram`, value, value_normalized, is_primary · [I] (organization_id, type, value_normalized) — **neunic**: duplicatele sunt permise dar semnalate; folosit pentru detectarea duplicatelor și identificarea expeditorului în inbox

**`leads`**
- organization_id, title, pipeline_id ⇉, stage_id ⇉ pipeline_stages, status `open/won/lost` (sincronizat cu `kind` al etapei prin trigger)
- company_id ⇉, source_id ⇉, responsible_id, team_id ⇉, priority `low/normal/high/urgent`
- value numeric, currency, won_amount numeric, closed_at, loss_reason_id ⇉, loss_comment
- description, custom_fields jsonb, position double precision (ordine kanban)
- stage_entered_at, last_activity_at, next_task_due_at (denormalizat prin trigger din `tasks`)
- created_by, created_at, updated_at, deleted_at
- [I] (organization_id, pipeline_id, stage_id, position) — kanban; (organization_id, responsible_id); (organization_id, team_id); (organization_id, status, closed_at); (organization_id, created_at); trigram pe title
- CHECK: `status='won' ⇒ closed_at not null`; `status='lost' ⇒ loss_reason_id not null` (aplicat în acțiune, întărit prin trigger)

**`lead_contacts`** — organization_id, lead_id ⇉, contact_id ⇉, is_primary, role · PK (lead_id, contact_id) · [U parțial] un singur `is_primary` per lead. *Un contact poate avea mai multe lead-uri; un lead poate avea mai multe contacte.* Telefonul/e-mailul lead-ului se iau din contactul principal (fără duplicare de date).

**Etichete** — `lead_tags`, `contact_tags`, `company_tags`, `conversation_tags` (organization_id, entity_id ⇉, tag_id ⇉) · PK compus. Tabele separate pentru FK-uri reale.

**`lead_stage_history`** (bigint) — organization_id, lead_id ⇉, from_stage_id, to_stage_id, changed_by, changed_at, time_in_previous interval · scris de trigger la schimbarea `stage_id` · baza pentru conversia între etape și durata ciclului de vânzare.

## 4. Activitate, note, fișiere

Parent polimorf controlat: coloane FK nulabile `lead_id`, `contact_id`, `company_id` + `CHECK (num_nonnulls(lead_id, contact_id, company_id) >= 1)`.

| Tabel | Coloane principale |
|---|---|
| `notes` | organization_id, lead_id/contact_id/company_id, body, is_pinned, author_id, deleted_at |
| `files` | organization_id, lead_id/contact_id/company_id/message_id, storage_path [U], file_name, mime_type, size_bytes, uploaded_by |
| `activities` (bigint) | organization_id, type (`lead.created`, `lead.stage_changed`, `note.added`, `task.completed`, `message.received`, `field.updated`…), lead_id/contact_id/company_id, actor_id (null = sistem/automatizare), payload jsonb, occurred_at · [I] (organization_id, lead_id, occurred_at desc) etc. — **cronologia unificată** a fișei |

## 5. Sarcini și calendar

**`tasks`** — organization_id, type_id ⇉ task_types, title, description, responsible_id, lead_id ⇉, contact_id ⇉, company_id ⇉, starts_at/due_at, duration_minutes, all_day, priority, status `new/in_progress/done/cancelled`, completed_at, result, reminder_at, reminder_sent_at, created_by · [I] (organization_id, responsible_id, status, due_at)

„Întârziată” = vedere calculată (`due_at < now() and status in ('new','in_progress')`). Calendarul afișează `tasks` (întâlnirile sunt sarcini de tip `meeting` cu durată) — fără tabel separat de evenimente.

## 6. Inbox

| Tabel | Coloane principale |
|---|---|
| `channels` | organization_id, provider `internal/whatsapp/instagram/messenger/email/telephony/web_form`, name, status `active/disconnected/error`, config jsonb (non-secret), vault_secret_id, webhook_secret_hash |
| `conversations` | organization_id, channel_id ⇉, contact_id ⇉, lead_id ⇉, assignee_id, status `open/pending/closed`, external_thread_id, subject, last_message_at, last_message_preview, unread_count · [U] (channel_id, external_thread_id) · [I] (organization_id, assignee_id, status, last_message_at desc) |
| `messages` (bigint) | organization_id, conversation_id ⇉, kind `message/internal_note/system`, direction `in/out`, sender_user_id, body, content_type, external_message_id, delivery_status `queued/sent/delivered/read/failed`, error, sent_at · [U parțial] (organization_id, external_message_id) |
| `conversation_reads` | conversation_id, user_id, last_read_message_id — necitite per utilizator |
| `quick_replies` | organization_id, title, shortcut, body, owner_id (null = partajat) |
| `webhook_events` (bigint) | organization_id (nullable până la rutare), provider, external_event_id, payload jsonb, signature_valid, received_at, processed_at, error · [U] (provider, external_event_id) |

## 7. Automatizări și notificări

| Tabel | Coloane principale |
|---|---|
| `domain_events` (bigint, outbox) | organization_id, type, entity_type, entity_id, payload jsonb, caused_by_automation_id, occurred_at, processed_at, attempts, locked_until · [I parțial] unde `processed_at is null` |
| `automations` | organization_id, name, trigger_type (`lead.created`, `lead.stage_entered`, `lead.won`, `lead.lost`, `task.due_soon`, `lead.inactive`, `message.received`), trigger_config jsonb (etapă, prag zile/ore), conditions jsonb (arbore AND/OR de reguli câmp-operator-valoare), actions jsonb (listă ordonată: `assign_responsible`, `create_task`, `notify`, `add_tag`, `change_stage`, `require_loss_reason`, `record_revenue`), is_active, pipeline_id ⇉, created_by |
| `automation_runs` (bigint) | organization_id, automation_id ⇉, event_id → domain_events, dedupe_key, status `success/skipped/failed`, started_at, finished_at, error, result jsonb · [U] (automation_id, dedupe_key) — **previne execuțiile duplicate** |
| `notifications` (bigint) | organization_id, user_id, type, title, body, entity_type, entity_id, read_at · [I] (user_id, read_at, created_at desc) |
| `notification_preferences` | organization_id, user_id, type, in_app, email · PK (organization_id, user_id, type) |

Declanșatoarele bazate pe timp (`task.due_soon`, `lead.inactive`) sunt generate de un job periodic cu `dedupe_key` determinist (ex. `lead:{id}:inactive:{yyyy-mm-dd}`).

## 8. Integrări, import, audit

| Tabel | Coloane principale |
|---|---|
| `api_keys` | organization_id, name, key_prefix, key_hash [U], scopes text[], last_used_at, revoked_at, created_by |
| `import_jobs` | organization_id, entity, status `pending/processing/done/failed`, file_path, mapping jsonb, total/ok/failed counts, errors jsonb, created_by |
| `audit_log` (bigint) | organization_id, actor_id, action `insert/update/delete`, table_name, record_id, old_data jsonb, new_data jsonb, created_at · [I] (organization_id, table_name, record_id) · doar INSERT prin trigger, fără UPDATE/DELETE |

## 9. Relații principale

```
organizations 1─N memberships N─1 profiles      roles 1─N memberships
organizations 1─N teams 1─N team_members N─1 profiles
pipelines 1─N pipeline_stages 1─N leads
companies 1─N contacts        contacts N─M leads (lead_contacts)
companies 1─N leads           contacts 1─N contact_identities
leads 1─N lead_stage_history · notes · files · activities · tasks · conversations
channels 1─N conversations 1─N messages 1─N files
automations 1─N automation_runs N─1 domain_events
```

## 10. Model RLS (rezumat)

- `SELECT` pe orice tabel: `private.is_member(organization_id)`.
- `leads` (și entitățile derivate: tasks, conversations): în plus, după `private.lead_scope(organization_id)` — `all` → tot; `team` → `team_id = any(user_team_ids)` sau `responsible_id = auth.uid()`; `own` → `responsible_id = auth.uid()`.
- `INSERT/UPDATE/DELETE`: `private.has_perm(organization_id, '<permisiune>')` + reguli de proprietar.
- Tabele de configurare (pipelines, roles, automations…): scriere doar cu `settings.manage`/`pipelines.manage`/`automations.manage`.
- `audit_log`, `domain_events`, `automation_runs`, `webhook_events`: fără scriere din client; scriere doar prin triggere/`service_role`.
- Storage: politică pe `bucket_id = 'crm-files'` și primul segment al căii = organizație din care utilizatorul face parte.
