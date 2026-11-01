-- =============================================================================
-- Etapa 3 · Activitate: note, fișiere, cronologie (activities), sarcini.
-- Părinte polimorf controlat: lead_id / contact_id / company_id, FK-uri reale.
-- =============================================================================

-- Rândul copil e vizibil doar dacă toți părinții setați sunt vizibili (RLS-ul părinților).
create or replace function private.parents_visible(p_lead uuid, p_contact uuid, p_company uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select (p_lead is null or exists (select 1 from public.leads where id = p_lead))
     and (p_contact is null or exists (select 1 from public.contacts where id = p_contact))
     and (p_company is null or exists (select 1 from public.companies where id = p_company))
$$;
grant execute on function private.parents_visible to authenticated;

-- -----------------------------------------------------------------------------
-- Note
-- -----------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid,
  contact_id uuid,
  company_id uuid,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  is_pinned boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(lead_id, contact_id, company_id) >= 1),
  foreign key (organization_id, lead_id) references public.leads (organization_id, id) on delete cascade,
  foreign key (organization_id, contact_id) references public.contacts (organization_id, id) on delete cascade,
  foreign key (organization_id, company_id) references public.companies (organization_id, id) on delete cascade
);
create index notes_lead_idx on public.notes (lead_id, created_at desc) where lead_id is not null;
create index notes_contact_idx on public.notes (contact_id, created_at desc) where contact_id is not null;
create index notes_company_idx on public.notes (company_id, created_at desc) where company_id is not null;

-- -----------------------------------------------------------------------------
-- Fișiere (metadate; conținutul e în Storage, bucket crm-files, cale {org}/...)
-- -----------------------------------------------------------------------------
create table public.files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid,
  contact_id uuid,
  company_id uuid,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (char_length(mime_type) <= 100),
  size_bytes bigint not null check (size_bytes between 0 and 26214400),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(lead_id, contact_id, company_id) >= 1),
  check (split_part(storage_path, '/', 1) = organization_id::text),
  foreign key (organization_id, lead_id) references public.leads (organization_id, id) on delete cascade,
  foreign key (organization_id, contact_id) references public.contacts (organization_id, id) on delete cascade,
  foreign key (organization_id, company_id) references public.companies (organization_id, id) on delete cascade
);
create index files_lead_idx on public.files (lead_id) where lead_id is not null;
create index files_contact_idx on public.files (contact_id) where contact_id is not null;
create index files_company_idx on public.files (company_id) where company_id is not null;

-- -----------------------------------------------------------------------------
-- Cronologia unificată (scrisă doar de triggere)
-- -----------------------------------------------------------------------------
create table public.activities (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type text not null check (type ~ '^[a-z_]+\.[a-z_]+$'),
  lead_id uuid,
  contact_id uuid,
  company_id uuid,
  actor_id uuid references public.profiles (id) on delete set null, -- null = sistem / automatizare
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (organization_id, lead_id) references public.leads (organization_id, id) on delete cascade,
  foreign key (organization_id, contact_id) references public.contacts (organization_id, id) on delete cascade,
  foreign key (organization_id, company_id) references public.companies (organization_id, id) on delete cascade
);
create index activities_lead_idx on public.activities (lead_id, occurred_at desc) where lead_id is not null;
create index activities_contact_idx on public.activities (contact_id, occurred_at desc) where contact_id is not null;
create index activities_company_idx on public.activities (company_id, occurred_at desc) where company_id is not null;
create index activities_org_idx on public.activities (organization_id, occurred_at desc);

-- -----------------------------------------------------------------------------
-- Sarcini (și evenimentele din calendar: întâlnirile sunt sarcini cu durată)
-- -----------------------------------------------------------------------------
create type public.task_status as enum ('new', 'in_progress', 'done', 'cancelled');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (char_length(description) <= 5000),
  responsible_id uuid,
  lead_id uuid,
  contact_id uuid,
  company_id uuid,
  starts_at timestamptz,
  due_at timestamptz not null,
  duration_minutes int check (duration_minutes between 1 and 1440),
  all_day boolean not null default false,
  priority public.lead_priority not null default 'normal',
  status public.task_status not null default 'new',
  completed_at timestamptz,
  result text check (char_length(result) <= 2000),
  reminder_at timestamptz,
  reminder_sent_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- „Întârziată” nu se stochează: due_at < now() și status deschis.
  check ((status in ('done', 'cancelled')) = (completed_at is not null)),
  check (starts_at is null or starts_at <= due_at),
  unique (organization_id, id),
  foreign key (organization_id, type_id) references public.task_types (organization_id, id),
  foreign key (organization_id, responsible_id)
    references public.memberships (organization_id, user_id) on delete set null (responsible_id),
  foreign key (organization_id, lead_id) references public.leads (organization_id, id) on delete cascade,
  foreign key (organization_id, contact_id) references public.contacts (organization_id, id) on delete cascade,
  foreign key (organization_id, company_id) references public.companies (organization_id, id) on delete cascade
);
create index tasks_responsible_idx on public.tasks (organization_id, responsible_id, status, due_at);
create index tasks_open_due_idx on public.tasks (organization_id, due_at) where status in ('new', 'in_progress');
create index tasks_lead_idx on public.tasks (lead_id, due_at) where lead_id is not null;
create index tasks_contact_idx on public.tasks (contact_id) where contact_id is not null;
create index tasks_reminder_idx on public.tasks (reminder_at)
  where reminder_sent_at is null and status in ('new', 'in_progress');

create or replace function private.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.completed_at := case when new.status in ('done', 'cancelled') then now() end;
  end if;
  return new;
end;
$$;

create trigger tasks_before_write before insert or update on public.tasks
  for each row execute function private.tasks_before_write();

-- leads.next_task_due_at = cea mai apropiată sarcină deschisă a lead-ului.
create or replace function private.refresh_lead_next_task(p_lead uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.leads l
  set next_task_due_at = (
    select min(t.due_at) from public.tasks t
    where t.lead_id = p_lead and t.status in ('new', 'in_progress')
  )
  where l.id = p_lead
    and l.next_task_due_at is distinct from (
      select min(t.due_at) from public.tasks t
      where t.lead_id = p_lead and t.status in ('new', 'in_progress')
    )
$$;

create or replace function private.tasks_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('INSERT', 'UPDATE') and new.lead_id is not null then
    perform private.refresh_lead_next_task(new.lead_id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') and old.lead_id is not null
     and (tg_op = 'DELETE' or old.lead_id is distinct from new.lead_id) then
    perform private.refresh_lead_next_task(old.lead_id);
  end if;
  return null;
end;
$$;

create trigger tasks_after_write
  after insert or delete or update of due_at, status, lead_id on public.tasks
  for each row execute function private.tasks_after_write();

-- Triggere comune
create trigger set_updated_at before update on public.notes
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.tasks
  for each row execute function private.set_updated_at();
create trigger set_created_by before insert on public.notes
  for each row execute function private.set_created_by();
create trigger set_created_by before insert on public.files
  for each row execute function private.set_created_by();
create trigger set_created_by before insert on public.tasks
  for each row execute function private.set_created_by();

-- -----------------------------------------------------------------------------
-- Drepturi + RLS
-- -----------------------------------------------------------------------------
revoke all on public.notes, public.files, public.activities, public.tasks from anon, authenticated;

grant select, delete on public.notes, public.files, public.tasks to authenticated;
grant select on public.activities to authenticated;
grant insert (organization_id, lead_id, contact_id, company_id, body, is_pinned), update (body, is_pinned)
  on public.notes to authenticated;
grant insert (id, organization_id, lead_id, contact_id, company_id, storage_path, file_name, mime_type, size_bytes)
  on public.files to authenticated;
grant insert (id, organization_id, type_id, title, description, responsible_id, lead_id, contact_id, company_id,
              starts_at, due_at, duration_minutes, all_day, priority, status, result, reminder_at),
  update (type_id, title, description, responsible_id, lead_id, contact_id, company_id, starts_at, due_at,
          duration_minutes, all_day, priority, status, result, reminder_at)
  on public.tasks to authenticated;

alter table public.notes enable row level security;
alter table public.files enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;

-- Note: oricine vede părintele le citește și poate adăuga; autorul (sau adminul) le modifică.
create policy "visible notes" on public.notes for select to authenticated
  using (private.is_member(organization_id) and private.parents_visible(lead_id, contact_id, company_id));
create policy "members add notes" on public.notes for insert to authenticated
  with check (private.is_member(organization_id) and private.parents_visible(lead_id, contact_id, company_id));
create policy "author updates notes" on public.notes for update to authenticated
  using (created_by = (select auth.uid()) or private.is_admin(organization_id))
  with check (private.parents_visible(lead_id, contact_id, company_id));
create policy "author deletes notes" on public.notes for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin(organization_id));

-- Fișiere
create policy "visible files" on public.files for select to authenticated
  using (private.is_member(organization_id) and private.parents_visible(lead_id, contact_id, company_id));
create policy "members add files" on public.files for insert to authenticated
  with check (private.is_member(organization_id) and private.parents_visible(lead_id, contact_id, company_id));
create policy "uploader deletes files" on public.files for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin(organization_id));

-- Cronologie: doar citire
create policy "visible activities" on public.activities for select to authenticated
  using (private.is_member(organization_id) and private.parents_visible(lead_id, contact_id, company_id));

-- Sarcini: vizibile după responsabil (aceeași regulă ca lead-urile) sau pentru autor.
create policy "visible tasks" on public.tasks for select to authenticated
  using (private.can_see_record(organization_id, responsible_id, null) or created_by = (select auth.uid()));
create policy "members create tasks" on public.tasks for insert to authenticated
  with check (private.is_member(organization_id) and private.parents_visible(lead_id, contact_id, company_id));
create policy "responsible or author updates tasks" on public.tasks for update to authenticated
  using (private.can_see_record(organization_id, responsible_id, null) or created_by = (select auth.uid()))
  with check (private.is_member(organization_id) and private.parents_visible(lead_id, contact_id, company_id));
create policy "author or admin deletes tasks" on public.tasks for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin(organization_id));

-- -----------------------------------------------------------------------------
-- Storage: bucket privat, primul segment al căii = organizația
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-files', 'crm-files', false, 26214400)
on conflict (id) do nothing;

create or replace function private.storage_org(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_name, '/', 1)::uuid end
$$;
grant execute on function private.storage_org to authenticated;

create policy "crm-files members read" on storage.objects for select to authenticated
  using (bucket_id = 'crm-files' and private.is_member(private.storage_org(name)));
create policy "crm-files members upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'crm-files' and private.is_member(private.storage_org(name)));
create policy "crm-files owner or admin deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'crm-files'
         and (owner_id = (select auth.uid())::text or private.is_admin(private.storage_org(name))));
