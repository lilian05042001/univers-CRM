-- =============================================================================
-- Etapa 3 · Entități CRM: companii, contacte, identități, lead-uri, legături,
-- etichete, istoricul etapelor + vizibilitate pe rol (toate / echipă / proprii).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Vizibilitate
-- -----------------------------------------------------------------------------
-- 'all' | 'team' | 'own' pentru utilizatorul curent; null dacă nu e membru activ.
create or replace function private.crm_scope(p_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when bool_or(r.key = 'admin' or 'crm.view.all' = any (r.permissions)) then 'all'
           when bool_or('crm.view.team' = any (r.permissions)) then 'team'
           else 'own'
         end
  from public.memberships m
  join public.roles r on r.id = m.role_id
  where m.organization_id = p_org
    and m.user_id = (select auth.uid())
    and m.status = 'active'
  having count(*) > 0
$$;

-- Echipele utilizatorului curent (ca membru sau manager).
create or replace function private.user_team_ids(p_org uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct t.id), '{}')
  from public.teams t
  left join public.team_members tm on tm.team_id = t.id
  where t.organization_id = p_org
    and ((select auth.uid()) = t.manager_id or tm.user_id = (select auth.uid()))
$$;

-- Colegii din echipele utilizatorului curent (membri + manageri).
create or replace function private.team_user_ids(p_org uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct u), '{}')
  from public.teams t
  left join public.team_members tm on tm.team_id = t.id
  cross join lateral (values (tm.user_id), (t.manager_id)) as x(u)
  where t.id = any (private.user_team_ids(p_org))
    and u is not null
$$;

-- Regula unică de vizibilitate pentru înregistrările CRM.
-- Înregistrările fără responsabil sunt vizibile tuturor membrilor (pot fi preluate).
create or replace function private.can_see_record(p_org uuid, p_owner uuid, p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case private.crm_scope(p_org)
    when 'all' then true
    when 'team' then p_owner is null
                     or p_owner = (select auth.uid())
                     or p_owner = any (private.team_user_ids(p_org))
                     or p_team = any (private.user_team_ids(p_org))
    when 'own' then p_owner is null or p_owner = (select auth.uid())
    else false
  end
$$;

revoke all on function private.crm_scope, private.user_team_ids, private.team_user_ids,
  private.can_see_record from public;
grant execute on function private.crm_scope, private.user_team_ids, private.team_user_ids,
  private.can_see_record to authenticated;

-- Normalizare pentru detectarea duplicatelor (aplicația trimite deja E.164 când poate).
create or replace function private.normalize_identity(p_type text, p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_type = 'phone' or p_type = 'whatsapp' then
      regexp_replace(regexp_replace(btrim(coalesce(p_value, '')), '[^0-9+]', '', 'g'), '^00', '+')
    else lower(btrim(coalesce(p_value, '')))
  end
$$;

-- Ștergerea logică (deleted_at) cere aceeași permisiune ca ștergerea definitivă.
create or replace function private.guard_soft_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deleted_at is distinct from old.deleted_at
     and current_user = 'authenticated'
     and not private.has_perm(new.organization_id, tg_argv[0]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- created_by nu poate fi falsificat din client.
create or replace function private.set_created_by()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' or new.created_by is null then
    new.created_by := (select auth.uid());
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Companii și contacte
-- -----------------------------------------------------------------------------
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  industry text check (char_length(industry) <= 100),
  phone text check (char_length(phone) <= 40),
  phone_normalized text generated always as (nullif(private.normalize_identity('phone', phone), '')) stored,
  email text check (email = lower(btrim(email)) and char_length(email) <= 254),
  website text check (char_length(website) <= 300),
  address jsonb not null default '{}'::jsonb check (jsonb_typeof(address) = 'object'),
  owner_id uuid,
  custom_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_fields) = 'object'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, owner_id)
    references public.memberships (organization_id, user_id) on delete set null (owner_id)
);
create index companies_name_trgm on public.companies
  using gin (private.search_norm(name) extensions.gin_trgm_ops);
create index companies_phone_idx on public.companies (organization_id, phone_normalized)
  where phone_normalized is not null;
create index companies_email_idx on public.companies (organization_id, email) where email is not null;
create index companies_owner_idx on public.companies (organization_id, owner_id);
create index companies_created_idx on public.companies (organization_id, created_at desc)
  where deleted_at is null;
create index companies_custom_fields_idx on public.companies using gin (custom_fields jsonb_path_ops);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 80),
  last_name text not null default '' check (char_length(last_name) <= 80),
  full_name text generated always as (btrim(first_name || ' ' || last_name)) stored,
  company_id uuid,
  position text check (char_length(position) <= 100),
  address jsonb not null default '{}'::jsonb check (jsonb_typeof(address) = 'object'),
  source_id uuid,
  owner_id uuid,
  custom_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_fields) = 'object'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (btrim(first_name || last_name) <> ''),
  unique (organization_id, id),
  foreign key (organization_id, company_id)
    references public.companies (organization_id, id) on delete set null (company_id),
  foreign key (organization_id, source_id)
    references public.lead_sources (organization_id, id) on delete set null (source_id),
  foreign key (organization_id, owner_id)
    references public.memberships (organization_id, user_id) on delete set null (owner_id)
);
create index contacts_name_trgm on public.contacts
  using gin (private.search_norm(full_name) extensions.gin_trgm_ops);
create index contacts_company_idx on public.contacts (organization_id, company_id);
create index contacts_owner_idx on public.contacts (organization_id, owner_id);
create index contacts_created_idx on public.contacts (organization_id, created_at desc)
  where deleted_at is null;
create index contacts_custom_fields_idx on public.contacts using gin (custom_fields jsonb_path_ops);

create table public.contact_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  contact_id uuid not null,
  type text not null check (type in ('phone', 'email', 'whatsapp', 'instagram', 'messenger', 'telegram')),
  value text not null check (char_length(btrim(value)) between 1 and 254),
  value_normalized text generated always as (private.normalize_identity(type, value)) stored,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (organization_id, contact_id)
    references public.contacts (organization_id, id) on delete cascade
);
-- Neunic: duplicatele sunt permise, dar găsite rapid (detectare la creare / import / inbox).
create index contact_identities_lookup on public.contact_identities (organization_id, type, value_normalized);
create index contact_identities_contact on public.contact_identities (contact_id);
create unique index contact_identities_one_primary
  on public.contact_identities (contact_id, type) where is_primary;

-- -----------------------------------------------------------------------------
-- Lead-uri
-- -----------------------------------------------------------------------------
create type public.lead_priority as enum ('low', 'normal', 'high', 'urgent');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  pipeline_id uuid not null,
  stage_id uuid not null,
  status public.stage_kind not null default 'open', -- derivat din etapă (trigger)
  company_id uuid,
  source_id uuid,
  value numeric(14, 2) not null default 0 check (value >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'), -- implicit: moneda organizației
  won_amount numeric(14, 2) check (won_amount >= 0),
  closed_at timestamptz,
  loss_reason_id uuid,
  loss_comment text check (char_length(loss_comment) <= 1000),
  responsible_id uuid,
  team_id uuid,
  priority public.lead_priority not null default 'normal',
  description text check (char_length(description) <= 10000),
  custom_fields jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_fields) = 'object'),
  position double precision not null default 0, -- ordinea în coloana kanban
  stage_entered_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  next_task_due_at timestamptz, -- denormalizat din tasks (trigger)
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((status = 'open') = (closed_at is null)),
  check (status = 'won' or won_amount is null),
  unique (organization_id, id),
  foreign key (organization_id, pipeline_id, stage_id)
    references public.pipeline_stages (organization_id, pipeline_id, id),
  foreign key (organization_id, company_id)
    references public.companies (organization_id, id) on delete set null (company_id),
  foreign key (organization_id, source_id)
    references public.lead_sources (organization_id, id) on delete set null (source_id),
  foreign key (organization_id, loss_reason_id)
    references public.loss_reasons (organization_id, id) on delete set null (loss_reason_id),
  foreign key (organization_id, responsible_id)
    references public.memberships (organization_id, user_id) on delete set null (responsible_id),
  foreign key (organization_id, team_id)
    references public.teams (organization_id, id) on delete set null (team_id)
);
create index leads_kanban_idx on public.leads (organization_id, pipeline_id, stage_id, position)
  where deleted_at is null;
create index leads_responsible_idx on public.leads (organization_id, responsible_id);
create index leads_team_idx on public.leads (organization_id, team_id);
create index leads_company_idx on public.leads (organization_id, company_id);
create index leads_status_closed_idx on public.leads (organization_id, status, closed_at);
create index leads_created_idx on public.leads (organization_id, created_at desc) where deleted_at is null;
create index leads_last_activity_idx on public.leads (organization_id, last_activity_at)
  where status = 'open' and deleted_at is null;
create index leads_title_trgm on public.leads
  using gin (private.search_norm(title) extensions.gin_trgm_ops);
create index leads_custom_fields_idx on public.leads using gin (custom_fields jsonb_path_ops);

create table public.lead_contacts (
  organization_id uuid not null,
  lead_id uuid not null,
  contact_id uuid not null,
  is_primary boolean not null default false,
  role text check (char_length(role) <= 60),
  created_at timestamptz not null default now(),
  primary key (lead_id, contact_id),
  foreign key (organization_id, lead_id) references public.leads (organization_id, id) on delete cascade,
  foreign key (organization_id, contact_id) references public.contacts (organization_id, id) on delete cascade
);
create index lead_contacts_contact_idx on public.lead_contacts (organization_id, contact_id);
create unique index lead_contacts_one_primary on public.lead_contacts (lead_id) where is_primary;

create table public.lead_tags (
  organization_id uuid not null,
  lead_id uuid not null,
  tag_id uuid not null,
  primary key (lead_id, tag_id),
  foreign key (organization_id, lead_id) references public.leads (organization_id, id) on delete cascade,
  foreign key (organization_id, tag_id) references public.tags (organization_id, id) on delete cascade
);
create index lead_tags_tag_idx on public.lead_tags (organization_id, tag_id);

create table public.contact_tags (
  organization_id uuid not null,
  contact_id uuid not null,
  tag_id uuid not null,
  primary key (contact_id, tag_id),
  foreign key (organization_id, contact_id) references public.contacts (organization_id, id) on delete cascade,
  foreign key (organization_id, tag_id) references public.tags (organization_id, id) on delete cascade
);
create index contact_tags_tag_idx on public.contact_tags (organization_id, tag_id);

create table public.company_tags (
  organization_id uuid not null,
  company_id uuid not null,
  tag_id uuid not null,
  primary key (company_id, tag_id),
  foreign key (organization_id, company_id) references public.companies (organization_id, id) on delete cascade,
  foreign key (organization_id, tag_id) references public.tags (organization_id, id) on delete cascade
);
create index company_tags_tag_idx on public.company_tags (organization_id, tag_id);

create table public.lead_stage_history (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null,
  pipeline_id uuid references public.pipelines (id) on delete set null,
  from_stage_id uuid references public.pipeline_stages (id) on delete set null,
  to_stage_id uuid references public.pipeline_stages (id) on delete set null,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  time_in_previous interval,
  foreign key (organization_id, lead_id) references public.leads (organization_id, id) on delete cascade
);
create index lead_stage_history_lead_idx on public.lead_stage_history (lead_id, changed_at);
create index lead_stage_history_org_idx on public.lead_stage_history (organization_id, changed_at);

-- -----------------------------------------------------------------------------
-- Triggere pe lead-uri
-- -----------------------------------------------------------------------------
-- Status, date de închidere, moneda implicită și dreptul de a atribui altcuiva.
create or replace function private.leads_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind public.stage_kind;
  v_stage_changed boolean := tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id;
begin
  if tg_op = 'INSERT' and new.currency is null then
    select currency into new.currency from public.organizations where id = new.organization_id;
  end if;

  if current_user = 'authenticated'
     and new.responsible_id is not null
     and new.responsible_id <> (select auth.uid())
     and (tg_op = 'INSERT' or new.responsible_id is distinct from old.responsible_id)
     and not private.has_perm(new.organization_id, 'leads.assign') then
    raise exception 'assign_forbidden' using errcode = '42501';
  end if;

  if v_stage_changed then
    select kind into v_kind from public.pipeline_stages where id = new.stage_id;
    new.status := v_kind;
    new.stage_entered_at := now();
    new.last_activity_at := now();

    if v_kind = 'open' then
      new.closed_at := null;
      new.won_amount := null;
      new.loss_reason_id := null;
      new.loss_comment := null;
    elsif v_kind = 'won' then
      new.closed_at := coalesce(new.closed_at, now());
      new.won_amount := coalesce(new.won_amount, new.value);
      new.loss_reason_id := null;
      new.loss_comment := null;
    else
      new.closed_at := coalesce(new.closed_at, now());
      new.won_amount := null;
    end if;
  end if;

  return new;
end;
$$;

create trigger leads_before_write before insert or update on public.leads
  for each row execute function private.leads_before_write();

-- Istoricul etapelor: baza pentru conversia între etape și durata ciclului de vânzare.
create or replace function private.leads_stage_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    insert into public.lead_stage_history
      (organization_id, lead_id, pipeline_id, from_stage_id, to_stage_id, changed_by, time_in_previous)
    values (
      new.organization_id, new.id, new.pipeline_id,
      case when tg_op = 'UPDATE' then old.stage_id end,
      new.stage_id,
      (select auth.uid()),
      case when tg_op = 'UPDATE' then now() - old.stage_entered_at end
    );
  end if;
  return null;
end;
$$;

create trigger leads_stage_history after insert or update of stage_id on public.leads
  for each row execute function private.leads_stage_history();

-- -----------------------------------------------------------------------------
-- Triggere comune
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.companies
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.contacts
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.leads
  for each row execute function private.set_updated_at();

create trigger set_created_by before insert on public.companies
  for each row execute function private.set_created_by();
create trigger set_created_by before insert on public.contacts
  for each row execute function private.set_created_by();
create trigger set_created_by before insert on public.leads
  for each row execute function private.set_created_by();

create trigger guard_soft_delete before update of deleted_at on public.companies
  for each row execute function private.guard_soft_delete('contacts.delete');
create trigger guard_soft_delete before update of deleted_at on public.contacts
  for each row execute function private.guard_soft_delete('contacts.delete');
create trigger guard_soft_delete before update of deleted_at on public.leads
  for each row execute function private.guard_soft_delete('leads.delete');

-- -----------------------------------------------------------------------------
-- Drepturi pe coloane
-- -----------------------------------------------------------------------------
revoke all on public.companies, public.contacts, public.contact_identities, public.leads,
  public.lead_contacts, public.lead_tags, public.contact_tags, public.company_tags,
  public.lead_stage_history from anon, authenticated;

grant select, delete on public.companies, public.contacts, public.contact_identities, public.leads,
  public.lead_contacts, public.lead_tags, public.contact_tags, public.company_tags to authenticated;
grant select on public.lead_stage_history to authenticated;

grant insert (id, organization_id, name, industry, phone, email, website, address, owner_id, custom_fields),
  update (name, industry, phone, email, website, address, owner_id, custom_fields, deleted_at)
  on public.companies to authenticated;
grant insert (id, organization_id, first_name, last_name, company_id, position, address, source_id, owner_id,
              custom_fields),
  update (first_name, last_name, company_id, position, address, source_id, owner_id, custom_fields, deleted_at)
  on public.contacts to authenticated;
grant insert (organization_id, contact_id, type, value, is_primary), update (value, is_primary)
  on public.contact_identities to authenticated;
grant insert (id, organization_id, title, pipeline_id, stage_id, company_id, source_id, value, currency,
              responsible_id, team_id, priority, description, custom_fields, position),
  update (title, pipeline_id, stage_id, company_id, source_id, value, currency, won_amount, closed_at,
          loss_reason_id, loss_comment, responsible_id, team_id, priority, description, custom_fields,
          position, deleted_at)
  on public.leads to authenticated;
grant insert (organization_id, lead_id, contact_id, is_primary, role), update (is_primary, role)
  on public.lead_contacts to authenticated;
grant insert (organization_id, lead_id, tag_id) on public.lead_tags to authenticated;
grant insert (organization_id, contact_id, tag_id) on public.contact_tags to authenticated;
grant insert (organization_id, company_id, tag_id) on public.company_tags to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_identities enable row level security;
alter table public.leads enable row level security;
alter table public.lead_contacts enable row level security;
alter table public.lead_tags enable row level security;
alter table public.contact_tags enable row level security;
alter table public.company_tags enable row level security;
alter table public.lead_stage_history enable row level security;

-- Companii și contacte: permisiunile contacts.* se aplică ambelor.
create policy "visible companies" on public.companies for select to authenticated
  using (private.can_see_record(organization_id, owner_id, null));
create policy "contacts.create inserts companies" on public.companies for insert to authenticated
  with check (private.has_perm(organization_id, 'contacts.create'));
create policy "contacts.edit updates companies" on public.companies for update to authenticated
  using (private.has_perm(organization_id, 'contacts.edit') and private.can_see_record(organization_id, owner_id, null))
  with check (private.has_perm(organization_id, 'contacts.edit'));
create policy "contacts.delete deletes companies" on public.companies for delete to authenticated
  using (private.has_perm(organization_id, 'contacts.delete') and private.can_see_record(organization_id, owner_id, null));

create policy "visible contacts" on public.contacts for select to authenticated
  using (private.can_see_record(organization_id, owner_id, null));
create policy "contacts.create inserts contacts" on public.contacts for insert to authenticated
  with check (private.has_perm(organization_id, 'contacts.create'));
create policy "contacts.edit updates contacts" on public.contacts for update to authenticated
  using (private.has_perm(organization_id, 'contacts.edit') and private.can_see_record(organization_id, owner_id, null))
  with check (private.has_perm(organization_id, 'contacts.edit'));
create policy "contacts.delete deletes contacts" on public.contacts for delete to authenticated
  using (private.has_perm(organization_id, 'contacts.delete') and private.can_see_record(organization_id, owner_id, null));

-- Lead-uri
create policy "visible leads" on public.leads for select to authenticated
  using (private.can_see_record(organization_id, responsible_id, team_id));
create policy "leads.create inserts leads" on public.leads for insert to authenticated
  with check (private.has_perm(organization_id, 'leads.create'));
create policy "leads.edit updates leads" on public.leads for update to authenticated
  using (private.has_perm(organization_id, 'leads.edit') and private.can_see_record(organization_id, responsible_id, team_id))
  with check (private.has_perm(organization_id, 'leads.edit'));
create policy "leads.delete deletes leads" on public.leads for delete to authenticated
  using (private.has_perm(organization_id, 'leads.delete') and private.can_see_record(organization_id, responsible_id, team_id));

-- Tabele copil: vizibile dacă părintele e vizibil (subinterogarea respectă RLS-ul părintelui).
create policy "visible contact identities" on public.contact_identities for select to authenticated
  using (exists (select 1 from public.contacts c where c.id = contact_id));
create policy "contacts.edit writes identities" on public.contact_identities for all to authenticated
  using ((private.has_perm(organization_id, 'contacts.edit') or private.has_perm(organization_id, 'contacts.create'))
         and exists (select 1 from public.contacts c where c.id = contact_id))
  with check ((private.has_perm(organization_id, 'contacts.edit') or private.has_perm(organization_id, 'contacts.create'))
              and exists (select 1 from public.contacts c where c.id = contact_id));

create policy "visible lead contacts" on public.lead_contacts for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy "leads.edit writes lead contacts" on public.lead_contacts for all to authenticated
  using ((private.has_perm(organization_id, 'leads.edit') or private.has_perm(organization_id, 'leads.create'))
         and exists (select 1 from public.leads l where l.id = lead_id))
  with check ((private.has_perm(organization_id, 'leads.edit') or private.has_perm(organization_id, 'leads.create'))
              and exists (select 1 from public.leads l where l.id = lead_id)
              and exists (select 1 from public.contacts c where c.id = contact_id));

create policy "visible lead tags" on public.lead_tags for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy "leads.edit writes lead tags" on public.lead_tags for all to authenticated
  using ((private.has_perm(organization_id, 'leads.edit') or private.has_perm(organization_id, 'leads.create'))
         and exists (select 1 from public.leads l where l.id = lead_id))
  with check ((private.has_perm(organization_id, 'leads.edit') or private.has_perm(organization_id, 'leads.create'))
              and exists (select 1 from public.leads l where l.id = lead_id));

create policy "visible contact tags" on public.contact_tags for select to authenticated
  using (exists (select 1 from public.contacts c where c.id = contact_id));
create policy "contacts.edit writes contact tags" on public.contact_tags for all to authenticated
  using ((private.has_perm(organization_id, 'contacts.edit') or private.has_perm(organization_id, 'contacts.create'))
         and exists (select 1 from public.contacts c where c.id = contact_id))
  with check ((private.has_perm(organization_id, 'contacts.edit') or private.has_perm(organization_id, 'contacts.create'))
              and exists (select 1 from public.contacts c where c.id = contact_id));

create policy "visible company tags" on public.company_tags for select to authenticated
  using (exists (select 1 from public.companies c where c.id = company_id));
create policy "contacts.edit writes company tags" on public.company_tags for all to authenticated
  using ((private.has_perm(organization_id, 'contacts.edit') or private.has_perm(organization_id, 'contacts.create'))
         and exists (select 1 from public.companies c where c.id = company_id))
  with check ((private.has_perm(organization_id, 'contacts.edit') or private.has_perm(organization_id, 'contacts.create'))
              and exists (select 1 from public.companies c where c.id = company_id));

create policy "visible stage history" on public.lead_stage_history for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
