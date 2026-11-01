-- =============================================================================
-- Etapa 3 · Configurarea CRM: pipeline-uri, etape, reguli de atribuire, surse,
-- etichete, motive de pierdere, tipuri de activități, câmpuri personalizate.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() nu e IMMUTABLE; wrapper-ul permite indexuri de căutare fără diacritice.
create or replace function private.search_norm(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_text, '')))
$$;
grant execute on function private.search_norm to authenticated;

-- -----------------------------------------------------------------------------
-- Pipeline-uri și etape
-- -----------------------------------------------------------------------------
create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  is_default boolean not null default false,
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index pipelines_one_default on public.pipelines (organization_id) where is_default;

create type public.stage_kind as enum ('open', 'won', 'lost');

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  pipeline_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  color text not null default '#3b82f6' check (color ~ '^#[0-9a-fA-F]{6}$'),
  position int not null default 0,
  kind public.stage_kind not null default 'open',
  probability smallint not null default 0 check (probability between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  -- permite FK-ul leads(organization_id, pipeline_id, stage_id): etapa aparține pipeline-ului
  unique (organization_id, pipeline_id, id),
  foreign key (organization_id, pipeline_id)
    references public.pipelines (organization_id, id) on delete cascade
);
create index pipeline_stages_pipeline_idx on public.pipeline_stages (pipeline_id, position);
-- Exact o etapă finală „câștigat” și una „pierdut” per pipeline.
create unique index pipeline_stages_one_won on public.pipeline_stages (pipeline_id) where kind = 'won';
create unique index pipeline_stages_one_lost on public.pipeline_stages (pipeline_id) where kind = 'lost';

create table public.assignment_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  pipeline_id uuid not null,
  strategy text not null check (strategy in ('round_robin', 'least_loaded', 'fixed')),
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, pipeline_id)
    references public.pipelines (organization_id, id) on delete cascade
);
create unique index assignment_rules_one_per_pipeline on public.assignment_rules (pipeline_id);

-- -----------------------------------------------------------------------------
-- Dicționare
-- -----------------------------------------------------------------------------
create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  channel text not null default 'manual' check (
    channel in ('manual', 'web_form', 'whatsapp', 'instagram', 'messenger', 'email', 'phone',
                'referral', 'import', 'api', 'other')
  ),
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index lead_sources_org_name_key on public.lead_sources (organization_id, lower(name));

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index tags_org_name_key on public.tags (organization_id, lower(name));

create table public.loss_reasons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index loss_reasons_org_name_key on public.loss_reasons (organization_id, lower(name));

create table public.task_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  icon text not null default 'check-square' check (icon ~ '^[a-z0-9-]{1,40}$'),
  is_system boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (organization_id, key),
  unique (organization_id, id)
);

create table public.custom_field_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity text not null check (entity in ('lead', 'contact', 'company')),
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  type text not null check (type in ('text', 'number', 'date', 'select', 'multiselect', 'bool', 'url')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  is_required boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, entity, key)
);

create trigger set_updated_at before update on public.pipelines
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.pipeline_stages
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.assignment_rules
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.custom_field_definitions
  for each row execute function private.set_updated_at();

-- Tipurile de activitate de sistem nu se șterg și nu își schimbă cheia.
create or replace function private.guard_task_types()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.is_system then
    raise exception 'system_task_type_delete' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and (new.key <> old.key or new.is_system <> old.is_system) then
    raise exception 'task_type_key_immutable' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger guard_task_types before update or delete on public.task_types
  for each row execute function private.guard_task_types();

-- -----------------------------------------------------------------------------
-- Valori implicite pentru o organizație nouă
-- -----------------------------------------------------------------------------
create or replace function private.seed_crm_defaults(p_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pipeline uuid;
begin
  insert into public.pipelines (organization_id, name, is_default)
  values (p_org, 'Vânzări', true)
  returning id into v_pipeline;

  insert into public.pipeline_stages (organization_id, pipeline_id, name, color, position, kind, probability)
  values
    (p_org, v_pipeline, 'Lead nou',                    '#64748b', 1, 'open', 10),
    (p_org, v_pipeline, 'Contactare',                  '#0ea5e9', 2, 'open', 20),
    (p_org, v_pipeline, 'Contactat',                   '#3b82f6', 3, 'open', 30),
    (p_org, v_pipeline, 'Identificarea necesităților', '#6366f1', 4, 'open', 45),
    (p_org, v_pipeline, 'Ofertă prezentată',           '#8b5cf6', 5, 'open', 60),
    (p_org, v_pipeline, 'Negociere',                   '#f59e0b', 6, 'open', 80),
    (p_org, v_pipeline, 'Câștigat',                    '#16a34a', 7, 'won', 100),
    (p_org, v_pipeline, 'Pierdut',                     '#dc2626', 8, 'lost', 0);

  insert into public.lead_sources (organization_id, name, channel, position)
  values
    (p_org, 'Manual', 'manual', 1),
    (p_org, 'Website', 'web_form', 2),
    (p_org, 'WhatsApp', 'whatsapp', 3),
    (p_org, 'Instagram', 'instagram', 4),
    (p_org, 'Facebook', 'messenger', 5),
    (p_org, 'Telefon', 'phone', 6),
    (p_org, 'Recomandare', 'referral', 7),
    (p_org, 'Import', 'import', 8);

  insert into public.loss_reasons (organization_id, name, position)
  values
    (p_org, 'Preț prea mare', 1),
    (p_org, 'A ales un concurent', 2),
    (p_org, 'Fără buget', 3),
    (p_org, 'Nu mai răspunde', 4),
    (p_org, 'Nu are nevoie', 5),
    (p_org, 'Altul', 6);

  insert into public.task_types (organization_id, key, name, icon, is_system, position)
  values
    (p_org, 'call', 'Apel', 'phone', true, 1),
    (p_org, 'meeting', 'Întâlnire', 'users', true, 2),
    (p_org, 'message', 'Mesaj', 'message-square', true, 3),
    (p_org, 'email', 'E-mail', 'mail', true, 4),
    (p_org, 'follow_up', 'Follow-up', 'repeat', true, 5),
    (p_org, 'general', 'Sarcină generală', 'check-square', true, 6);
end;
$$;
revoke all on function private.seed_crm_defaults from public;

-- Onboarding-ul creează acum și configurarea CRM implicită.
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
           'contacts.create', 'contacts.edit', 'contacts.delete', 'reports.view.team', 'data.export']),
    (p_org, 'agent', 'Agent', 'Lucrează cu lead-urile și clienții atribuiți', true,
     array['leads.create', 'leads.edit', 'contacts.create', 'contacts.edit']);

  perform private.seed_crm_defaults(p_org);
  return v_admin_role;
end;
$$;

-- Organizațiile existente primesc configurarea implicită.
do $$
declare
  v_org uuid;
begin
  for v_org in select id from public.organizations o
               where not exists (select 1 from public.pipelines p where p.organization_id = o.id)
  loop
    perform private.seed_crm_defaults(v_org);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Drepturi + RLS: citire pentru membri, scriere pentru cine configurează
-- -----------------------------------------------------------------------------
revoke all on public.pipelines, public.pipeline_stages, public.assignment_rules, public.lead_sources,
  public.tags, public.loss_reasons, public.task_types, public.custom_field_definitions
  from anon, authenticated;

grant select, insert, delete on public.pipelines, public.pipeline_stages, public.assignment_rules,
  public.lead_sources, public.tags, public.loss_reasons, public.task_types,
  public.custom_field_definitions to authenticated;

grant update (name, is_default, position, archived_at) on public.pipelines to authenticated;
grant update (name, color, position, kind, probability) on public.pipeline_stages to authenticated;
grant update (strategy, config, is_active) on public.assignment_rules to authenticated;
grant update (name, channel, position, is_active) on public.lead_sources to authenticated;
grant update (name, color) on public.tags to authenticated;
grant update (name, position, is_active) on public.loss_reasons to authenticated;
grant update (name, icon, position) on public.task_types to authenticated;
grant update (label, type, options, is_required, position) on public.custom_field_definitions to authenticated;

do $$
declare
  t text;
  v_perm text;
begin
  foreach t in array array['pipelines', 'pipeline_stages', 'assignment_rules', 'lead_sources', 'tags',
                           'loss_reasons', 'task_types', 'custom_field_definitions']
  loop
    v_perm := case when t in ('pipelines', 'pipeline_stages', 'assignment_rules')
                   then 'pipelines.manage' else 'settings.manage' end;
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "members read %1$s" on public.%1$I for select to authenticated
         using (private.is_member(organization_id))', t);
    execute format(
      'create policy "%2$s inserts %1$s" on public.%1$I for insert to authenticated
         with check (private.has_perm(organization_id, %2$L))', t, v_perm);
    execute format(
      'create policy "%2$s updates %1$s" on public.%1$I for update to authenticated
         using (private.has_perm(organization_id, %2$L))
         with check (private.has_perm(organization_id, %2$L))', t, v_perm);
    execute format(
      'create policy "%2$s deletes %1$s" on public.%1$I for delete to authenticated
         using (private.has_perm(organization_id, %2$L))', t, v_perm);
  end loop;
end;
$$;
