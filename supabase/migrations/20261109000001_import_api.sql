-- =============================================================================
-- Etapa 11 · Import CSV pe loturi (joburi cu raport de erori), chei API și
-- accesul service_role folosit de API-ul public v1.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Joburi de import: fișierul e citit în browser și trimis pe loturi; jobul ține
-- progresul, contoarele și primele 1000 de erori (rând + cod).
-- -----------------------------------------------------------------------------
create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity text not null check (entity in ('contacts', 'companies')),
  status text not null default 'processing' check (status in ('processing', 'done', 'failed', 'cancelled')),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 255),
  -- skip_duplicates, create_companies, default_owner_id
  options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object'),
  mapping jsonb not null default '{}'::jsonb check (jsonb_typeof(mapping) = 'object'),
  total_rows int not null check (total_rows between 1 and 50000),
  processed_rows int not null default 0,
  ok_count int not null default 0,
  skipped_count int not null default 0,
  failed_count int not null default 0,
  errors jsonb not null default '[]'::jsonb check (jsonb_typeof(errors) = 'array'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index import_jobs_org_idx on public.import_jobs (organization_id, created_at desc);

create trigger set_created_by before insert on public.import_jobs
  for each row execute function private.set_created_by();

revoke all on public.import_jobs from anon, authenticated;
grant select on public.import_jobs to authenticated;
grant insert (organization_id, entity, file_name, options, mapping, total_rows) on public.import_jobs to authenticated;
-- Progresul și finalizarea trec doar prin import_rows / finish_import.

alter table public.import_jobs enable row level security;
create policy "importer or admin reads import jobs" on public.import_jobs for select to authenticated
  using (private.has_perm(organization_id, 'data.import')
         and (created_by = (select auth.uid()) or private.has_perm(organization_id, 'settings.manage')));
create policy "data.import creates import jobs" on public.import_jobs for insert to authenticated
  with check (private.has_perm(organization_id, 'data.import')
              and private.has_perm(organization_id, 'contacts.create')
              and status = 'processing');

-- Potrivirea exactă după nume (duplicate la import, compania unui contact): indexul trigram nu e eficient
-- pentru egalitate între nume asemănătoare.
create index companies_search_eq on public.companies (organization_id, search_text) where deleted_at is null;

-- Rezolvarea valorilor text din fișier (ridică un cod de eroare dacă nu există).
create or replace function private.import_owner(p_org uuid, p_email text, p_default uuid)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if nullif(btrim(coalesce(p_email, '')), '') is null then
    if p_default is not null and not exists (
      select 1 from public.memberships
      where organization_id = p_org and user_id = p_default and status = 'active'
    ) then
      raise exception 'unknown_owner';
    end if;
    return p_default;
  end if;

  select m.user_id into v_user
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.organization_id = p_org and m.status = 'active' and lower(p.email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'unknown_owner';
  end if;
  return v_user;
end;
$$;

create or replace function private.import_source(p_org uuid, p_name text)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    return null;
  end if;
  select id into v_id from public.lead_sources
  where organization_id = p_org and lower(name) = lower(btrim(p_name))
  order by is_active desc, position
  limit 1;
  if v_id is null then
    raise exception 'unknown_source';
  end if;
  return v_id;
end;
$$;

create or replace function private.import_tags(p_org uuid, p_names jsonb)
returns uuid[]
language plpgsql
stable
set search_path = ''
as $$
declare
  v_names text[] := array(
    select distinct lower(btrim(n)) from jsonb_array_elements_text(coalesce(p_names, '[]'::jsonb)) n
    where btrim(n) <> '');
  v_ids uuid[];
begin
  select array_agg(distinct t.id) into v_ids
  from public.tags t
  where t.organization_id = p_org and lower(t.name) = any (v_names);
  if coalesce(cardinality(v_ids), 0) < cardinality(v_names) then
    raise exception 'unknown_tag';
  end if;
  return coalesce(v_ids, '{}');
end;
$$;

-- Compania unui contact: după nume (fără diacritice / majuscule); creată dacă lipsește și opțiunea o permite.
create or replace function private.import_company_ref(p_job public.import_jobs, p_name text, p_owner uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    return null;
  end if;
  select id into v_id from public.companies
  where organization_id = p_job.organization_id
    and search_text = private.search_norm(p_name)
    and deleted_at is null
  order by created_at
  limit 1;
  if v_id is null then
    if not coalesce((p_job.options ->> 'create_companies')::boolean, true) then
      raise exception 'unknown_company';
    end if;
    insert into public.companies (organization_id, name, owner_id)
    values (p_job.organization_id, left(btrim(p_name), 200), p_owner)
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Un rând de contact: null = importat, 'duplicate' = sărit (telefon / e-mail existent).
create or replace function private.import_contact(p_job public.import_jobs, r jsonb)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_org uuid := p_job.organization_id;
  v_id uuid := gen_random_uuid();
  v_owner uuid;
  v_phones text[] := array(
    select private.normalize_identity('phone', v) from jsonb_array_elements_text(coalesce(r -> 'phones', '[]'::jsonb)) v);
  v_emails text[] := array(
    select private.normalize_identity('email', v) from jsonb_array_elements_text(coalesce(r -> 'emails', '[]'::jsonb)) v);
begin
  -- Valorile normalizate sunt calculate înainte: căutarea folosește indexul (organization_id, type, value_normalized)
  -- și nu încetinește pe măsură ce organizația are mai multe contacte.
  if coalesce((p_job.options ->> 'skip_duplicates')::boolean, true) and (
    exists (select 1 from public.contact_identities ci join public.contacts c on c.id = ci.contact_id
            where ci.organization_id = v_org and ci.type = 'phone' and ci.value_normalized = any (v_phones)
              and c.deleted_at is null)
    or exists (select 1 from public.contact_identities ci join public.contacts c on c.id = ci.contact_id
               where ci.organization_id = v_org and ci.type = 'email' and ci.value_normalized = any (v_emails)
                 and c.deleted_at is null)
  ) then
    return 'duplicate';
  end if;

  v_owner := private.import_owner(v_org, r ->> 'owner', (p_job.options ->> 'default_owner_id')::uuid);

  insert into public.contacts (id, organization_id, first_name, last_name, position, company_id, source_id,
                               owner_id, address, custom_fields)
  values (
    v_id, v_org,
    coalesce(r ->> 'first_name', ''), coalesce(r ->> 'last_name', ''),
    nullif(r ->> 'position', ''),
    private.import_company_ref(p_job, r ->> 'company', v_owner),
    private.import_source(v_org, r ->> 'source'),
    v_owner,
    jsonb_strip_nulls(jsonb_build_object('city', nullif(r ->> 'city', ''), 'street', nullif(r ->> 'street', ''))),
    coalesce(r -> 'custom_fields', '{}'::jsonb)
  );

  insert into public.contact_identities (organization_id, contact_id, type, value, is_primary)
  select v_org, v_id, 'phone', v, ord = 1
  from jsonb_array_elements_text(coalesce(r -> 'phones', '[]'::jsonb)) with ordinality x(v, ord)
  union all
  select v_org, v_id, 'email', v, ord = 1
  from jsonb_array_elements_text(coalesce(r -> 'emails', '[]'::jsonb)) with ordinality x(v, ord);

  insert into public.contact_tags (organization_id, contact_id, tag_id)
  select v_org, v_id, t from unnest(private.import_tags(v_org, r -> 'tags')) t;
  return null;
end;
$$;

-- Un rând de companie: duplicat = același nume, telefon sau e-mail.
create or replace function private.import_company(p_job public.import_jobs, r jsonb)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_org uuid := p_job.organization_id;
  v_id uuid := gen_random_uuid();
  v_name text := private.search_norm(r ->> 'name');
  v_phone text := nullif(private.normalize_identity('phone', r ->> 'phone'), '');
  v_email text := nullif(lower(btrim(r ->> 'email')), '');
begin
  -- Trei căutări separate, fiecare pe indexul ei (companies_search_eq, companies_phone_idx, companies_email_idx).
  if coalesce((p_job.options ->> 'skip_duplicates')::boolean, true) and (
    exists (select 1 from public.companies
            where organization_id = v_org and search_text = v_name and deleted_at is null)
    or exists (select 1 from public.companies
               where organization_id = v_org and phone_normalized = v_phone and deleted_at is null)
    or exists (select 1 from public.companies
               where organization_id = v_org and email = v_email and deleted_at is null)
  ) then
    return 'duplicate';
  end if;

  insert into public.companies (id, organization_id, name, industry, phone, email, website, owner_id, address,
                                custom_fields)
  values (
    v_id, v_org, r ->> 'name',
    nullif(r ->> 'industry', ''), nullif(r ->> 'phone', ''), nullif(lower(btrim(r ->> 'email')), ''),
    nullif(r ->> 'website', ''),
    private.import_owner(v_org, r ->> 'owner', (p_job.options ->> 'default_owner_id')::uuid),
    jsonb_strip_nulls(jsonb_build_object('city', nullif(r ->> 'city', ''), 'street', nullif(r ->> 'street', ''))),
    coalesce(r -> 'custom_fields', '{}'::jsonb)
  );

  insert into public.company_tags (organization_id, company_id, tag_id)
  select v_org, v_id, t from unnest(private.import_tags(v_org, r -> 'tags')) t;
  return null;
end;
$$;

revoke all on function private.import_owner, private.import_source, private.import_tags,
  private.import_company_ref, private.import_contact, private.import_company from public;

-- Un lot (max. 1000 rânduri): fiecare rând într-o subtranzacție (un rând greșit nu oprește lotul).
-- p_rows: rânduri validate de server ({ row, ... }); p_errors: rândurile respinse la validare ({ row, code, field }).
-- security definer: verificări explicite (autorul jobului, data.import, contacts.create); FK-urile compuse
-- garantează că sursele, etichetele, companiile și responsabilii sunt din aceeași organizație.
-- plan_cache_mode: un plan generic memorat când tabelele erau mici (scanare secvențială) ar încetini
-- căutarea duplicatelor pe măsură ce importul adaugă rânduri; planurile custom văd mărimea curentă.
create or replace function public.import_rows(p_job uuid, p_rows jsonb, p_errors jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
set plan_cache_mode = force_custom_plan
as $$
declare
  v_job public.import_jobs;
  v_row jsonb;
  v_code text;
  v_ok int := 0;
  v_skipped int := 0;
  v_failed int := coalesce(jsonb_array_length(p_errors), 0);
  v_errors jsonb := coalesce(p_errors, '[]'::jsonb);
begin
  select * into v_job from public.import_jobs where id = p_job for update;
  if not found or v_job.created_by is distinct from (select auth.uid())
     or not private.has_perm(v_job.organization_id, 'data.import')
     or not private.has_perm(v_job.organization_id, 'contacts.create') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_job.status <> 'processing' then
    raise exception 'import_finished';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_typeof(v_errors) <> 'array'
     or jsonb_array_length(p_rows) + jsonb_array_length(v_errors) > 1000 then
    raise exception 'invalid_batch';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    begin
      if v_job.entity = 'contacts' then
        v_code := private.import_contact(v_job, v_row);
      else
        v_code := private.import_company(v_job, v_row);
      end if;
      if v_code is null then
        v_ok := v_ok + 1;
      else
        v_skipped := v_skipped + 1;
        v_errors := v_errors || jsonb_build_object('row', v_row -> 'row', 'code', v_code);
      end if;
    exception when others then
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object('row', v_row -> 'row', 'code',
        case
          when sqlerrm in ('unknown_owner', 'unknown_source', 'unknown_tag', 'unknown_company') then sqlerrm
          when sqlstate in ('23514', '22001', '22P02', '23502') then 'invalid_value'
          else 'db_error'
        end);
    end;
  end loop;

  -- Raportul păstrează primele 1000 de erori, în ordinea rândurilor.
  select coalesce(jsonb_agg(e order by (e ->> 'row')::int), '[]'::jsonb) into v_errors
  from (select e from jsonb_array_elements(v_errors) e
        order by (e ->> 'row')::int
        limit greatest(0, 1000 - jsonb_array_length(v_job.errors))) x;

  -- La fiecare 2000 de rânduri: statistici noi pentru tabelele în care se încarcă, altfel planificatorul
  -- le crede aproape goale și caută duplicatele prin scanări care cresc odată cu importul.
  if (v_job.processed_rows + jsonb_array_length(p_rows)) / 2000 > v_job.processed_rows / 2000 then
    if v_job.entity = 'contacts' then
      analyze public.contacts, public.contact_identities, public.companies;
    else
      analyze public.companies;
    end if;
  end if;

  update public.import_jobs
  set processed_rows = processed_rows + jsonb_array_length(p_rows) + coalesce(jsonb_array_length(p_errors), 0),
      ok_count = ok_count + v_ok,
      skipped_count = skipped_count + v_skipped,
      failed_count = failed_count + v_failed,
      errors = errors || v_errors,
      updated_at = now()
  where id = p_job;

  return jsonb_build_object('ok', v_ok, 'skipped', v_skipped, 'failed', v_failed);
end;
$$;

create or replace function public.finish_import(p_job uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('done', 'failed', 'cancelled') then
    raise exception 'invalid_batch';
  end if;
  update public.import_jobs
  set status = p_status, finished_at = now(), updated_at = now()
  where id = p_job and created_by = (select auth.uid()) and status = 'processing';
  if not found then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.import_rows, public.finish_import from public, anon;
grant execute on function public.import_rows, public.finish_import to authenticated;

-- Worker: evenimentele fără automatizări (ex. contact.created după un import mare) se finalizează
-- dintr-un singur apel, nu câte unul.
create or replace function public.complete_domain_events(p_ids bigint[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.domain_events
  set processed_at = now(), locked_until = null, last_error = null
  where id = any (p_ids) and processed_at is null
$$;

revoke all on function public.complete_domain_events from public, anon, authenticated;
grant execute on function public.complete_domain_events to service_role;

-- -----------------------------------------------------------------------------
-- Chei API: afișate o singură dată; în DB rămân prefixul vizibil și hash-ul sha256.
-- -----------------------------------------------------------------------------
create or replace function private.api_scopes()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['contacts:read', 'contacts:write', 'leads:read', 'leads:write']
$$;

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  key_prefix text not null check (char_length(key_prefix) between 8 and 20),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null check (cardinality(scopes) > 0 and scopes <@ private.api_scopes()),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index api_keys_org_idx on public.api_keys (organization_id, created_at desc);

create trigger set_created_by before insert on public.api_keys
  for each row execute function private.set_created_by();

-- Revocarea e definitivă.
create or replace function private.api_keys_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'api_key_revoked';
  end if;
  return new;
end;
$$;
create trigger api_keys_guard before update on public.api_keys
  for each row execute function private.api_keys_guard();

-- Hash-ul și ultima utilizare nu intră în jurnalul de audit.
create or replace function private.audit_ignored_keys()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['updated_at', 'last_activity_at', 'next_task_due_at', 'position', 'stage_entered_at',
               'token_hash', 'reminder_sent_at', 'phone_normalized', 'full_name', 'key_hash', 'last_used_at']
$$;
create trigger audit_row after insert or update or delete on public.api_keys
  for each row execute function private.audit_row();

revoke all on public.api_keys from anon, authenticated;
grant select (id, organization_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_by,
              created_at),
  insert (organization_id, name, key_prefix, key_hash, scopes, expires_at),
  update (name, revoked_at)
  on public.api_keys to authenticated;

alter table public.api_keys enable row level security;
create policy "api_keys.manage reads keys" on public.api_keys for select to authenticated
  using (private.has_perm(organization_id, 'api_keys.manage'));
create policy "api_keys.manage creates keys" on public.api_keys for insert to authenticated
  with check (private.has_perm(organization_id, 'api_keys.manage'));
create policy "api_keys.manage updates keys" on public.api_keys for update to authenticated
  using (private.has_perm(organization_id, 'api_keys.manage'))
  with check (private.has_perm(organization_id, 'api_keys.manage'));

-- Cheia e valabilă cât timp nu e revocată / expirată și autorul ei e încă membru activ.
-- last_used_at se actualizează cel mult o dată pe minut.
create or replace function public.authenticate_api_key(p_hash text)
returns table (key_id uuid, organization_id uuid, scopes text[], created_by uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.api_keys;
begin
  select k.* into v_key
  from public.api_keys k
  join public.memberships m
    on m.organization_id = k.organization_id and m.user_id = k.created_by and m.status = 'active'
  where k.key_hash = p_hash
    and k.revoked_at is null
    and (k.expires_at is null or k.expires_at > now());
  if not found then
    return;
  end if;
  if v_key.last_used_at is null or v_key.last_used_at < now() - interval '1 minute' then
    update public.api_keys set last_used_at = now() where id = v_key.id;
  end if;
  return query select v_key.id, v_key.organization_id, v_key.scopes, v_key.created_by;
end;
$$;

revoke all on function public.authenticate_api_key from public, anon, authenticated;
grant execute on function public.authenticate_api_key to service_role;

-- -----------------------------------------------------------------------------
-- API public v1 (src/lib/api): service_role, după autentificarea cheii; fiecare interogare
-- filtrează explicit pe organization_id-ul cheii. Doar coloanele folosite de API.
-- -----------------------------------------------------------------------------
grant usage on schema private to service_role;
grant select (id, currency) on public.organizations to service_role;
grant select on public.pipelines, public.pipeline_stages, public.custom_field_definitions, public.tags,
  public.lead_sources, public.memberships to service_role;
grant select on public.companies, public.contacts, public.contact_identities, public.leads,
  public.lead_contacts, public.lead_tags, public.contact_tags, public.company_tags to service_role;
grant insert (id, organization_id, name, industry, phone, email, website, address, owner_id, custom_fields,
              created_by),
  update (name, industry, phone, email, website, address, owner_id, custom_fields, deleted_at)
  on public.companies to service_role;
grant insert (id, organization_id, first_name, last_name, company_id, position, address, source_id, owner_id,
              custom_fields, created_by),
  update (first_name, last_name, company_id, position, address, source_id, owner_id, custom_fields, deleted_at)
  on public.contacts to service_role;
grant insert (id, organization_id, title, pipeline_id, stage_id, company_id, source_id, value, currency,
              responsible_id, team_id, priority, description, custom_fields, loss_reason_id, created_by),
  update (title, pipeline_id, stage_id, company_id, source_id, value, currency, responsible_id, team_id,
          priority, description, custom_fields, loss_reason_id, deleted_at)
  on public.leads to service_role;
grant insert (organization_id, contact_id, type, value, is_primary), delete on public.contact_identities to service_role;
grant insert (organization_id, lead_id, contact_id, is_primary), delete on public.lead_contacts to service_role;
grant insert (organization_id, lead_id, tag_id), delete on public.lead_tags to service_role;
grant insert (organization_id, contact_id, tag_id), delete on public.contact_tags to service_role;
grant insert (organization_id, company_id, tag_id), delete on public.company_tags to service_role;
