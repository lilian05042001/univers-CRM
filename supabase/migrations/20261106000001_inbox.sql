-- =============================================================================
-- Etapa 8 · Inbox: canale, conversații, mesaje, note interne, atașamente,
-- necitite per utilizator, răspunsuri rapide, etichete, evenimente webhook.
-- Canalul intern e funcțional; canalele externe folosesc aceeași infrastructură.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permisiune nouă: atribuirea conversațiilor altor colegi
-- -----------------------------------------------------------------------------
create or replace function private.permission_catalog()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'crm.view.all',       -- vede toate înregistrările CRM ale organizației
    'crm.view.team',      -- vede înregistrările echipelor sale (altfel: doar proprii)
    'leads.create', 'leads.edit', 'leads.delete', 'leads.assign',
    'contacts.create', 'contacts.edit', 'contacts.delete',
    'inbox.view.all', 'inbox.assign',
    'reports.view.all', 'reports.view.team',
    'data.import', 'data.export',
    'pipelines.manage', 'automations.manage',
    'team.manage', 'roles.manage', 'settings.manage', 'api_keys.manage'
  ]::text[]
$$;

-- Managerii existenți primesc dreptul de atribuire (administratorul îl are implicit).
update public.roles set permissions = permissions || array['inbox.assign']
where key = 'manager' and is_system and not ('inbox.assign' = any (permissions));

-- Inbox: toate (inbox.view.all) · altfel aceeași regulă ca lead-urile: echipa / proprii + neatribuite.
create or replace function private.can_see_conversation(p_org uuid, p_assignee uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_perm(p_org, 'inbox.view.all') or private.can_see_record(p_org, p_assignee, null)
$$;
revoke all on function private.can_see_conversation from public;
grant execute on function private.can_see_conversation to authenticated;

-- -----------------------------------------------------------------------------
-- Canale
-- -----------------------------------------------------------------------------
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null
    check (provider in ('internal', 'whatsapp', 'instagram', 'messenger', 'email', 'telephony', 'web_form')),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  status text not null default 'active' check (status in ('active', 'disconnected', 'error')),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'), -- doar valori nesecrete
  vault_secret_id uuid, -- credențialele furnizorului (Supabase Vault), la conectarea canalelor externe
  webhook_secret_hash text, -- sha256 al cheii webhook; cheia se afișează o singură dată
  has_webhook_secret boolean generated always as (webhook_secret_hash is not null) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index channels_one_internal on public.channels (organization_id) where provider = 'internal';

-- -----------------------------------------------------------------------------
-- Conversații
-- -----------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  channel_id uuid not null,
  contact_id uuid,
  lead_id uuid,
  assignee_id uuid,
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  -- Firul din canal (ex. numărul WhatsApp); conversațiile create manual primesc un id aleator.
  external_thread_id text not null default gen_random_uuid()::text check (char_length(external_thread_id) <= 200),
  subject text check (char_length(subject) <= 200),
  display_name text not null default '' check (char_length(display_name) <= 200),
  search_text text generated always as (private.search_norm(display_name || ' ' || coalesce(subject, ''))) stored,
  last_message_id bigint,
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '',
  last_message_direction text check (last_message_direction in ('in', 'out')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (channel_id, external_thread_id),
  foreign key (organization_id, channel_id) references public.channels (organization_id, id) on delete cascade,
  foreign key (organization_id, contact_id)
    references public.contacts (organization_id, id) on delete set null (contact_id),
  foreign key (organization_id, lead_id)
    references public.leads (organization_id, id) on delete set null (lead_id),
  foreign key (organization_id, assignee_id)
    references public.memberships (organization_id, user_id) on delete set null (assignee_id)
);
create index conversations_inbox_idx on public.conversations (organization_id, status, last_message_at desc);
create index conversations_assignee_idx on public.conversations (organization_id, assignee_id, status);
create index conversations_contact_idx on public.conversations (contact_id) where contact_id is not null;
create index conversations_lead_idx on public.conversations (lead_id) where lead_id is not null;
create index conversations_search_trgm on public.conversations using gin (search_text extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Mesaje (mesaje către/de la client, note interne, mesaje de sistem)
-- -----------------------------------------------------------------------------
create table public.messages (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null,
  kind text not null default 'message' check (kind in ('message', 'internal_note', 'system')),
  direction text not null default 'out' check (direction in ('in', 'out')),
  sender_user_id uuid references public.profiles (id) on delete set null,
  body text not null default '' check (char_length(body) <= 10000),
  content_type text not null default 'text' check (content_type in ('text', 'attachment')),
  external_message_id text check (char_length(external_message_id) <= 200),
  delivery_status text check (delivery_status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  error text check (char_length(error) <= 1000),
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (kind = 'message' or char_length(btrim(body)) > 0),
  unique (organization_id, id),
  foreign key (organization_id, conversation_id)
    references public.conversations (organization_id, id) on delete cascade
);
create index messages_conversation_idx on public.messages (conversation_id, id);
-- Idempotență: același mesaj extern nu se înregistrează de două ori.
create unique index messages_external_idx on public.messages (organization_id, external_message_id)
  where external_message_id is not null;

-- Necitite per utilizator: ultimul mesaj citit din fiecare conversație.
create table public.conversation_reads (
  organization_id uuid not null,
  conversation_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_message_id bigint not null default 0,
  read_at timestamptz not null default now(),
  primary key (conversation_id, user_id),
  foreign key (organization_id, conversation_id)
    references public.conversations (organization_id, id) on delete cascade
);

create table public.conversation_tags (
  organization_id uuid not null,
  conversation_id uuid not null,
  tag_id uuid not null,
  primary key (conversation_id, tag_id),
  foreign key (organization_id, conversation_id)
    references public.conversations (organization_id, id) on delete cascade,
  foreign key (organization_id, tag_id) references public.tags (organization_id, id) on delete cascade
);
create index conversation_tags_tag_idx on public.conversation_tags (organization_id, tag_id);

-- Răspunsuri rapide: partajate (owner_id null, gestionate de admin) sau personale.
create table public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 100),
  shortcut text check (shortcut ~ '^[a-z0-9_-]{1,30}$'),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  owner_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, owner_id)
    references public.memberships (organization_id, user_id) on delete cascade
);
create index quick_replies_org_idx on public.quick_replies (organization_id, owner_id);

-- Jurnalul cererilor webhook: deduplicare după (provider, id eveniment), reprocesare la eroare.
create table public.webhook_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete cascade, -- null până la rutare
  channel_id uuid references public.channels (id) on delete set null,
  provider text not null,
  external_event_id text not null check (char_length(external_event_id) <= 200),
  payload jsonb not null,
  signature_valid boolean not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, external_event_id)
);
create index webhook_events_org_idx on public.webhook_events (organization_id, received_at desc);

-- -----------------------------------------------------------------------------
-- Atașamente: fișierele pot aparține unui mesaj
-- -----------------------------------------------------------------------------
alter table public.files add column message_id bigint;
alter table public.files add foreign key (organization_id, message_id)
  references public.messages (organization_id, id) on delete cascade;
do $$
declare
  v_name text;
begin
  select conname into v_name from pg_constraint
  where conrelid = 'public.files'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%num_nonnulls%';
  execute format('alter table public.files drop constraint %I', v_name);
end;
$$;
alter table public.files add constraint files_parent_check
  check (num_nonnulls(lead_id, contact_id, company_id, message_id) >= 1);
create index files_message_idx on public.files (message_id) where message_id is not null;

-- Atașamentele nu apar în cronologia fișei (mesajul apare deja).
create or replace function private.notes_files_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'notes' then
    perform private.log_activity(new.organization_id, 'note.added', new.lead_id, new.contact_id, new.company_id,
      jsonb_build_object('note_id', new.id, 'excerpt', left(new.body, 200)));
  elsif new.message_id is null then
    perform private.log_activity(new.organization_id, 'file.added', new.lead_id, new.contact_id, new.company_id,
      jsonb_build_object('file_id', new.id, 'file_name', new.file_name, 'size_bytes', new.size_bytes));
  end if;
  if new.lead_id is not null then
    perform private.touch_lead(new.lead_id);
  end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Triggere
-- -----------------------------------------------------------------------------
-- Din client: atribuirea altcuiva decât sie cere inbox.assign (preluarea unei conversații neatribuite
-- e liberă); contactul / lead-ul asociat trebuie să fie vizibil, dar doar când se schimbă
-- (o conversație neatribuită a unui contact invizibil poate fi totuși preluată și închisă).
create or replace function private.conversations_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.assignee_id is not null
     and new.assignee_id <> (select auth.uid())
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and not private.has_perm(new.organization_id, 'inbox.assign') then
    raise exception 'assign_forbidden' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and ((new.contact_id is distinct from old.contact_id
           and not private.parents_visible(null, new.contact_id, null))
          or (new.lead_id is distinct from old.lead_id
              and not private.parents_visible(new.lead_id, null, null))) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger conversations_before_write before insert or update on public.conversations
  for each row execute function private.conversations_before_write();

-- Direcția, expeditorul și starea livrării nu pot fi falsificate din client.
create or replace function private.messages_before_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_provider text;
begin
  select ch.provider into v_provider
  from public.conversations c join public.channels ch on ch.id = c.channel_id
  where c.id = new.conversation_id;

  if current_user = 'authenticated' then
    new.sender_user_id := (select auth.uid());
    new.external_message_id := null;
    new.sent_at := now();
    -- Mesajele primite se pot înregistra manual doar pe canalul intern (apel, vizită, formular pe hârtie).
    if new.kind = 'message' and new.direction = 'in' and v_provider <> 'internal' then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;

  if new.kind <> 'message' then
    new.direction := 'out';
    new.delivery_status := null;
  elsif new.direction = 'out' then
    -- Canalul intern nu are livrare externă; celelalte așteaptă worker-ul (Etapa 9).
    new.delivery_status := case when v_provider = 'internal' then 'sent' else 'queued' end;
  else
    new.delivery_status := null;
  end if;
  return new;
end;
$$;

create trigger messages_before_insert before insert on public.messages
  for each row execute function private.messages_before_insert();

-- Ultimul mesaj, redeschiderea la mesaj nou, cronologia fișei, evenimentul message.received.
create or replace function private.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations;
  v_excerpt text := left(regexp_replace(btrim(new.body), '\s+', ' ', 'g'), 200);
begin
  if new.kind <> 'message' then
    return null;
  end if;

  update public.conversations
  set last_message_id = new.id,
      last_message_at = new.sent_at,
      last_message_preview = v_excerpt,
      last_message_direction = new.direction,
      status = case when new.direction = 'in' and status = 'closed' then 'open' else status end
  where id = new.conversation_id
  returning * into v_conv;

  if v_conv.contact_id is not null or v_conv.lead_id is not null then
    perform private.log_activity(new.organization_id,
      case new.direction when 'in' then 'message.received' else 'message.sent' end,
      v_conv.lead_id, v_conv.contact_id, null,
      jsonb_build_object('conversation_id', v_conv.id, 'message_id', new.id, 'excerpt', v_excerpt));
  end if;
  if v_conv.lead_id is not null then
    perform private.touch_lead(v_conv.lead_id);
  end if;

  if new.direction = 'in' then
    perform private.emit_event(new.organization_id, 'message.received', 'conversation', v_conv.id,
      jsonb_build_object('message_id', new.id, 'channel_id', v_conv.channel_id,
                         'contact_id', v_conv.contact_id, 'lead_id', v_conv.lead_id));
    if v_conv.assignee_id is distinct from new.sender_user_id then
      perform private.notify(new.organization_id, v_conv.assignee_id, 'message_received', v_conv.display_name,
                             v_excerpt, 'conversation', v_conv.id, '/inbox/' || v_conv.id);
    end if;
  end if;

  -- Autorul unui mesaj a citit conversația până la mesajul său.
  if new.sender_user_id is not null then
    insert into public.conversation_reads (organization_id, conversation_id, user_id, last_read_message_id)
    values (new.organization_id, new.conversation_id, new.sender_user_id, new.id)
    on conflict (conversation_id, user_id) do update
      set last_read_message_id = greatest(public.conversation_reads.last_read_message_id, excluded.last_read_message_id),
          read_at = now();
  end if;
  return null;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function private.messages_after_insert();

-- Notificări: conversație atribuită, mesaj nou într-o conversație atribuită.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('task_due_soon', 'task_overdue', 'task_assigned', 'lead_assigned',
                  'conversation_assigned', 'message_received'));
alter table public.notifications drop constraint notifications_entity_type_check;
alter table public.notifications add constraint notifications_entity_type_check
  check (entity_type in ('lead', 'contact', 'company', 'task', 'conversation'));
alter table public.notification_preferences drop constraint notification_preferences_type_check;
alter table public.notification_preferences add constraint notification_preferences_type_check
  check (type in ('task_due_soon', 'task_overdue', 'task_assigned', 'lead_assigned',
                  'conversation_assigned', 'message_received'));

create or replace function private.notify_conversation_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_id is not null
     and new.assignee_id is distinct from (select auth.uid())
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform private.notify(new.organization_id, new.assignee_id, 'conversation_assigned', new.display_name,
                           nullif(new.last_message_preview, ''), 'conversation', new.id, '/inbox/' || new.id);
  end if;
  return null;
end;
$$;

create trigger conversations_notify_assignment after insert or update of assignee_id on public.conversations
  for each row execute function private.notify_conversation_assignment();

create trigger set_updated_at before update on public.channels
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.conversations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.quick_replies
  for each row execute function private.set_updated_at();
create trigger set_created_by before insert on public.conversations
  for each row execute function private.set_created_by();
create trigger set_created_by before insert on public.quick_replies
  for each row execute function private.set_created_by();
create trigger audit_row after insert or update or delete on public.channels
  for each row execute function private.audit_row();
create trigger audit_row after insert or update or delete on public.conversations
  for each row execute function private.audit_row();

-- Câmpurile denormalizate ale conversației și hash-ul cheii webhook nu intră în audit.
create or replace function private.audit_ignored_keys()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['updated_at', 'last_activity_at', 'next_task_due_at', 'position', 'stage_entered_at',
               'token_hash', 'reminder_sent_at', 'overdue_notified_at', 'phone_normalized', 'full_name',
               'search_text', 'last_message_id', 'last_message_at', 'last_message_preview',
               'last_message_direction', 'webhook_secret_hash', 'has_webhook_secret']
$$;

-- -----------------------------------------------------------------------------
-- Drepturi
-- -----------------------------------------------------------------------------
revoke all on public.channels, public.conversations, public.messages, public.conversation_reads,
  public.conversation_tags, public.quick_replies, public.webhook_events from anon, authenticated;

-- Hash-ul cheii webhook și referința la Vault nu sunt lizibile din client
-- (hash-ul se poate doar înlocui, la regenerarea cheii, de cine are settings.manage).
grant select (id, organization_id, provider, name, status, config, has_webhook_secret, created_at, updated_at),
  update (name, status, webhook_secret_hash)
  on public.channels to authenticated;
grant select, delete on public.conversations to authenticated;
grant insert (id, organization_id, channel_id, contact_id, lead_id, assignee_id, status, subject, display_name),
  update (contact_id, lead_id, assignee_id, status, subject)
  on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant insert (organization_id, conversation_id, kind, direction, body, content_type) on public.messages to authenticated;
grant select on public.conversation_reads to authenticated;
grant insert (organization_id, conversation_id, user_id, last_read_message_id, read_at),
  update (last_read_message_id, read_at)
  on public.conversation_reads to authenticated;
grant select, delete on public.conversation_tags to authenticated;
grant insert (organization_id, conversation_id, tag_id) on public.conversation_tags to authenticated;
grant select, delete on public.quick_replies to authenticated;
grant insert (id, organization_id, title, shortcut, body, owner_id), update (title, shortcut, body)
  on public.quick_replies to authenticated;
grant insert (message_id) on public.files to authenticated;

-- service_role nu primește drepturi implicite: doar ce folosește endpoint-ul webhook
-- (ingestia propriu-zisă trece prin public.ingest_inbound_message, security definer).
grant select (id, organization_id, provider, status, webhook_secret_hash) on public.channels to service_role;
grant select, insert, update on public.webhook_events to service_role;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.channels enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_reads enable row level security;
alter table public.conversation_tags enable row level security;
alter table public.quick_replies enable row level security;
alter table public.webhook_events enable row level security; -- fără politici: doar service_role

create policy "members see channels" on public.channels for select to authenticated
  using (private.is_member(organization_id));
create policy "settings.manage updates channels" on public.channels for update to authenticated
  using (private.has_perm(organization_id, 'settings.manage'))
  with check (private.has_perm(organization_id, 'settings.manage'));

create policy "visible conversations" on public.conversations for select to authenticated
  using (private.can_see_conversation(organization_id, assignee_id));
create policy "members start conversations" on public.conversations for insert to authenticated
  with check (private.is_member(organization_id)
              and private.can_see_conversation(organization_id, assignee_id)
              and private.parents_visible(lead_id, contact_id, null));
-- Predarea către un coleg care nu e vizibil autorului trece prin public.assign_conversation().
create policy "members update visible conversations" on public.conversations for update to authenticated
  using (private.can_see_conversation(organization_id, assignee_id))
  with check (private.can_see_conversation(organization_id, assignee_id));
create policy "admin deletes conversations" on public.conversations for delete to authenticated
  using (private.is_admin(organization_id));

-- Mesajele: vizibile și adăugate de cine vede conversația; imuabile după trimitere.
create policy "visible messages" on public.messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id));
create policy "members add messages" on public.messages for insert to authenticated
  with check (private.is_member(organization_id)
              and exists (select 1 from public.conversations c where c.id = conversation_id));

create policy "own reads" on public.conversation_reads for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.conversations c where c.id = conversation_id));

create policy "visible conversation tags" on public.conversation_tags for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id));
create policy "members tag visible conversations" on public.conversation_tags for all to authenticated
  using (private.is_member(organization_id)
         and exists (select 1 from public.conversations c where c.id = conversation_id))
  with check (private.is_member(organization_id)
              and exists (select 1 from public.conversations c where c.id = conversation_id));

create policy "shared or own quick replies" on public.quick_replies for select to authenticated
  using (private.is_member(organization_id) and (owner_id is null or owner_id = (select auth.uid())));
create policy "manage quick replies" on public.quick_replies for all to authenticated
  using ((owner_id is null and private.has_perm(organization_id, 'settings.manage'))
         or (owner_id = (select auth.uid()) and private.is_member(organization_id)))
  with check ((owner_id is null and private.has_perm(organization_id, 'settings.manage'))
              or (owner_id = (select auth.uid()) and private.is_member(organization_id)));

-- Fișiere: un atașament e vizibil dacă mesajul (deci conversația) e vizibil.
drop policy "visible files" on public.files;
drop policy "members add files" on public.files;
create policy "visible files" on public.files for select to authenticated
  using (private.is_member(organization_id)
         and private.parents_visible(lead_id, contact_id, company_id)
         and (message_id is null or exists (select 1 from public.messages m where m.id = message_id)));
create policy "members add files" on public.files for insert to authenticated
  with check (private.is_member(organization_id)
              and private.parents_visible(lead_id, contact_id, company_id)
              and (message_id is null or exists (select 1 from public.messages m where m.id = message_id)));

alter publication supabase_realtime add table public.conversations, public.messages;

-- -----------------------------------------------------------------------------
-- RPC pentru client (security invoker: RLS se aplică)
-- -----------------------------------------------------------------------------
create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.conversation_reads (organization_id, conversation_id, user_id, last_read_message_id, read_at)
  select c.organization_id, c.id, (select auth.uid()), coalesce(c.last_message_id, 0), now()
  from public.conversations c
  where c.id = p_conversation
  on conflict (conversation_id, user_id) do update
    set last_read_message_id = greatest(public.conversation_reads.last_read_message_id,
                                        excluded.last_read_message_id),
        read_at = now()
$$;

-- Mesajele primite necitite de utilizatorul curent, pentru conversațiile date.
create or replace function public.inbox_unread_counts(p_ids uuid[])
returns table (conversation_id uuid, unread int)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id,
         (select count(*)::int from public.messages m
          where m.conversation_id = c.id and m.kind = 'message' and m.direction = 'in'
            and m.id > coalesce(r.last_read_message_id, 0))
  from public.conversations c
  left join public.conversation_reads r on r.conversation_id = c.id and r.user_id = (select auth.uid())
  where c.id = any (p_ids)
    and c.last_message_id > coalesce(r.last_read_message_id, 0)
$$;

-- Numărul de conversații deschise cu mesaje necitite (insigna din meniu).
create or replace function public.inbox_unread_total(p_org uuid)
returns int
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::int
  from public.conversations c
  left join public.conversation_reads r on r.conversation_id = c.id and r.user_id = (select auth.uid())
  where c.organization_id = p_org
    and c.status <> 'closed'
    and c.last_message_direction = 'in'
    and c.last_message_id > coalesce(r.last_read_message_id, 0)
$$;

revoke all on function public.mark_conversation_read, public.inbox_unread_counts, public.inbox_unread_total
  from public, anon;
grant execute on function public.mark_conversation_read, public.inbox_unread_counts, public.inbox_unread_total
  to authenticated;

-- Atribuire: preluare / eliberare de către cine vede conversația; altui coleg doar cu inbox.assign.
-- security definer: după predare conversația poate deveni invizibilă autorului (RLS ar refuza UPDATE-ul).
create or replace function public.assign_conversation(p_conversation uuid, p_assignee uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations;
begin
  select * into v_conv from public.conversations where id = p_conversation for update;
  if v_conv.id is null or not private.can_see_conversation(v_conv.organization_id, v_conv.assignee_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_assignee is not null and p_assignee <> (select auth.uid())
     and not private.has_perm(v_conv.organization_id, 'inbox.assign') then
    raise exception 'assign_forbidden' using errcode = '42501';
  end if;
  if p_assignee is not null and not exists (
    select 1 from public.memberships
    where organization_id = v_conv.organization_id and user_id = p_assignee and status = 'active') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.conversations set assignee_id = p_assignee where id = p_conversation;
end;
$$;
revoke all on function public.assign_conversation from public, anon;
grant execute on function public.assign_conversation to authenticated;

-- -----------------------------------------------------------------------------
-- Mesaj primit dintr-un canal (apelat doar de server cu service_role, după verificarea webhook-ului):
-- identificare contact după identitate → conversație (după firul extern) → mesaj (idempotent).
-- -----------------------------------------------------------------------------
create or replace function public.ingest_inbound_message(p_channel uuid, p_message jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_channel public.channels;
  v_type text := p_message ->> 'identity_type';
  v_value text := btrim(coalesce(p_message ->> 'identity_value', ''));
  v_name text := nullif(btrim(coalesce(p_message ->> 'sender_name', '')), '');
  v_body text := btrim(coalesce(p_message ->> 'body', ''));
  v_external text := nullif(btrim(coalesce(p_message ->> 'external_id', '')), '');
  v_contact uuid;
  v_owner uuid;
  v_created boolean := false;
  v_thread text;
  v_conversation uuid;
  v_message bigint;
  v_first text;
begin
  select * into v_channel from public.channels where id = p_channel;
  if v_channel.id is null or v_channel.status <> 'active' then
    raise exception 'channel_inactive' using errcode = 'P0001';
  end if;
  if v_type is null or v_type not in ('phone', 'email', 'whatsapp', 'instagram', 'messenger', 'telegram')
     or v_value = '' or v_body = '' then
    raise exception 'invalid_message' using errcode = 'P0001';
  end if;

  -- 1. Identificare: cel mai vechi contact activ cu aceeași identitate (telefon ≡ WhatsApp).
  select ci.contact_id, c.owner_id into v_contact, v_owner
  from public.contact_identities ci
  join public.contacts c on c.id = ci.contact_id and c.deleted_at is null
  where ci.organization_id = v_channel.organization_id
    and ci.type = any (case when v_type in ('phone', 'whatsapp') then array['phone', 'whatsapp'] else array[v_type] end)
    and ci.value_normalized = private.normalize_identity(v_type, v_value)
  order by c.created_at
  limit 1;

  if v_contact is null then
    v_first := split_part(coalesce(v_name, v_value), ' ', 1);
    insert into public.contacts (organization_id, first_name, last_name, source_id)
    values (v_channel.organization_id, left(v_first, 80),
            left(btrim(substr(coalesce(v_name, v_value), char_length(v_first) + 1)), 80),
            (select s.id from public.lead_sources s
             where s.organization_id = v_channel.organization_id and s.is_active
               and s.channel = case v_channel.provider when 'telephony' then 'phone' else v_channel.provider end
             order by s.position limit 1))
    returning id into v_contact;
    insert into public.contact_identities (organization_id, contact_id, type, value, is_primary)
    values (v_channel.organization_id, v_contact, v_type, v_value, true);
    v_created := true;
  end if;

  -- 2. Conversația firului (una per contact pe canalul intern, dacă expeditorul nu dă un fir),
  --    afișată cu numele din CRM al contactului.
  v_thread := coalesce(nullif(btrim(coalesce(p_message ->> 'thread_id', '')), ''), 'contact:' || v_contact);
  insert into public.conversations (organization_id, channel_id, contact_id, lead_id, assignee_id,
                                    external_thread_id, display_name)
  values (v_channel.organization_id, p_channel, v_contact,
          (select l.id from public.lead_contacts lc
           join public.leads l on l.id = lc.lead_id
           where lc.contact_id = v_contact and l.status = 'open' and l.deleted_at is null
           order by l.created_at desc limit 1),
          v_owner, v_thread,
          left(coalesce(nullif((select full_name from public.contacts where id = v_contact), ''), v_name, v_value), 200))
  on conflict (channel_id, external_thread_id) do nothing
  returning id into v_conversation;
  if v_conversation is null then
    select id into v_conversation from public.conversations
    where channel_id = p_channel and external_thread_id = v_thread;
  end if;

  -- 3. Mesajul (un mesaj extern deja primit nu se dublează).
  insert into public.messages (organization_id, conversation_id, kind, direction, body, external_message_id, sent_at)
  values (v_channel.organization_id, v_conversation, 'message', 'in', left(v_body, 10000), v_external,
          least(coalesce((p_message ->> 'sent_at')::timestamptz, now()), now()))
  on conflict (organization_id, external_message_id) where external_message_id is not null do nothing
  returning id into v_message;
  if v_message is null then
    select id into v_message from public.messages
    where organization_id = v_channel.organization_id and external_message_id = v_external;
  end if;

  return jsonb_build_object('organization_id', v_channel.organization_id, 'conversation_id', v_conversation,
                            'contact_id', v_contact, 'contact_created', v_created, 'message_id', v_message);
end;
$$;
revoke all on function public.ingest_inbound_message from public, anon, authenticated;
grant execute on function public.ingest_inbound_message to service_role;

-- -----------------------------------------------------------------------------
-- Unirea contactelor mută și conversațiile
-- -----------------------------------------------------------------------------
create or replace function public.merge_contacts(p_keep uuid, p_remove uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keep public.contacts;
  v_remove public.contacts;
  r record;
begin
  select * into v_keep from public.contacts where id = p_keep and deleted_at is null for update;
  select * into v_remove from public.contacts where id = p_remove and deleted_at is null for update;

  if v_keep.id is null or v_remove.id is null or p_keep = p_remove
     or v_keep.organization_id <> v_remove.organization_id then
    raise exception 'merge_invalid' using errcode = 'P0001';
  end if;
  if not (private.has_perm(v_keep.organization_id, 'contacts.edit')
          and private.has_perm(v_keep.organization_id, 'contacts.delete')
          and private.can_see_record(v_keep.organization_id, v_keep.owner_id, null)
          and private.can_see_record(v_remove.organization_id, v_remove.owner_id, null)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Identități: se mută cele care nu există deja pe contactul păstrat.
  delete from public.contact_identities ci
  where ci.contact_id = p_remove
    and exists (select 1 from public.contact_identities k
                where k.contact_id = p_keep and k.type = ci.type and k.value_normalized = ci.value_normalized);
  update public.contact_identities set contact_id = p_keep, is_primary = false where contact_id = p_remove;

  -- Lead-uri: legătura se mută; rolul de contact principal se păstrează.
  for r in delete from public.lead_contacts where contact_id = p_remove returning * loop
    insert into public.lead_contacts (organization_id, lead_id, contact_id, is_primary, role)
    values (r.organization_id, r.lead_id, p_keep, r.is_primary, r.role)
    on conflict (lead_id, contact_id)
    do update set is_primary = public.lead_contacts.is_primary or excluded.is_primary;
  end loop;

  insert into public.contact_tags (organization_id, contact_id, tag_id)
  select organization_id, p_keep, tag_id from public.contact_tags where contact_id = p_remove
  on conflict do nothing;
  delete from public.contact_tags where contact_id = p_remove;

  update public.notes set contact_id = p_keep where contact_id = p_remove;
  update public.files set contact_id = p_keep where contact_id = p_remove;
  update public.tasks set contact_id = p_keep where contact_id = p_remove;
  update public.activities set contact_id = p_keep where contact_id = p_remove;
  update public.conversations set contact_id = p_keep where contact_id = p_remove;

  update public.contacts
  set company_id = coalesce(company_id, v_remove.company_id),
      position = coalesce(position, v_remove.position),
      source_id = coalesce(source_id, v_remove.source_id),
      owner_id = coalesce(owner_id, v_remove.owner_id),
      custom_fields = v_remove.custom_fields || custom_fields
  where id = p_keep;

  update public.contacts set deleted_at = now() where id = p_remove;

  perform private.log_activity(v_keep.organization_id, 'contact.merged', null, p_keep, null,
    jsonb_build_object('merged_contact_id', p_remove, 'merged_name', v_remove.full_name));
  return p_keep;
end;
$$;

-- -----------------------------------------------------------------------------
-- Configurarea implicită: canalul intern (organizații noi și existente)
-- -----------------------------------------------------------------------------
create or replace function private.seed_inbox_defaults(p_org uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.channels (organization_id, provider, name)
  values (p_org, 'internal', 'Canal intern')
  on conflict do nothing
$$;
revoke all on function private.seed_inbox_defaults from public;

create or replace function private.seed_organization(p_org uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_role uuid;
begin
  insert into public.roles (organization_id, key, name, description, is_system, permissions)
  values (p_org, 'admin', 'Administrator', 'Acces complet și configurarea sistemului', true,
          private.permission_catalog())
  returning id into v_admin_role;

  insert into public.roles (organization_id, key, name, description, is_system, permissions)
  values
    (p_org, 'manager', 'Manager', 'Gestionează echipa, distribuie lead-uri, vede rapoartele echipei', true,
     array['crm.view.team', 'leads.create', 'leads.edit', 'leads.delete', 'leads.assign',
           'contacts.create', 'contacts.edit', 'contacts.delete', 'inbox.assign', 'reports.view.team',
           'data.export']),
    (p_org, 'agent', 'Agent', 'Lucrează cu lead-urile și clienții atribuiți', true,
     array['leads.create', 'leads.edit', 'contacts.create', 'contacts.edit']);

  perform private.seed_crm_defaults(p_org);
  perform private.seed_inbox_defaults(p_org);
  return v_admin_role;
end;
$$;

do $$
declare
  v_org uuid;
begin
  for v_org in select id from public.organizations loop
    perform private.seed_inbox_defaults(v_org);
  end loop;
end;
$$;
