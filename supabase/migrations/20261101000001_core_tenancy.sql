-- =============================================================================
-- Etapa 2 · Nucleu multi-tenant: organizații, profiluri, roluri, membri,
-- echipe, invitații + funcții de permisiuni + RLS.
-- =============================================================================

create schema if not exists private;
grant usage on schema private to authenticated;

-- Tabelele noi nu sunt accesibile rolului anon (nici un endpoint public pe date).
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon, public;

-- -----------------------------------------------------------------------------
-- Utilitare
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Catalogul permisiunilor. Sursa de adevăr; oglindit în src/modules/auth/permissions.ts.
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
    'inbox.view.all',
    'reports.view.all', 'reports.view.team',
    'data.import', 'data.export',
    'pipelines.manage', 'automations.manage',
    'team.manage', 'roles.manage', 'settings.manage', 'api_keys.manage'
  ]::text[]
$$;

-- -----------------------------------------------------------------------------
-- Tabele
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,70}$'),
  legal_name text check (char_length(legal_name) <= 200),
  fiscal_code text check (char_length(fiscal_code) <= 32),
  country char(2) not null default 'MD',
  currency char(3) not null default 'MDL',
  timezone text not null default 'Europe/Chisinau',
  default_locale text not null default 'ro' check (default_locale in ('ro', 'en', 'ru')),
  logo_path text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 32),
  avatar_path text,
  locale text not null default 'ro' check (locale in ('ro', 'en', 'ru')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  description text check (char_length(description) <= 300),
  is_system boolean not null default false,
  permissions text[] not null default '{}' check (permissions <@ private.permission_catalog()),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key),
  unique (organization_id, id)
);

create type public.membership_status as enum ('active', 'disabled');

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null,
  status public.membership_status not null default 'active',
  title text check (char_length(title) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  foreign key (organization_id, role_id) references public.roles (organization_id, id)
);
create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_role_idx on public.memberships (organization_id, role_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  manager_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, manager_id)
    references public.memberships (organization_id, user_id) on delete set null (manager_id)
);
create unique index teams_org_name_key on public.teams (organization_id, lower(name));

create table public.team_members (
  organization_id uuid not null,
  team_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id),
  foreign key (organization_id, team_id)
    references public.teams (organization_id, id) on delete cascade,
  foreign key (organization_id, user_id)
    references public.memberships (organization_id, user_id) on delete cascade
);
create index team_members_user_idx on public.team_members (organization_id, user_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  role_id uuid not null,
  team_id uuid,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (organization_id, role_id) references public.roles (organization_id, id) on delete cascade,
  foreign key (organization_id, team_id)
    references public.teams (organization_id, id) on delete set null (team_id)
);
create unique index invitations_pending_email_key
  on public.invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;

-- updated_at
create trigger set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.roles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.memberships
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.teams
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Funcții de autorizare (folosite în politici RLS și în server)
-- -----------------------------------------------------------------------------
create or replace function private.is_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
$$;

create or replace function private.is_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and r.key = 'admin'
  )
$$;

create or replace function private.has_perm(p_org uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (r.key = 'admin' or p_perm = any (r.permissions))
  )
$$;

-- Utilizatorul curent și p_user au cel puțin o organizație comună.
create or replace function private.shares_org(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships me
    join public.memberships other on other.organization_id = me.organization_id
    where me.user_id = (select auth.uid())
      and me.status = 'active'
      and other.user_id = p_user
  )
$$;

revoke all on function private.is_member, private.is_admin, private.has_perm, private.shares_org from public;
grant execute on function private.is_member, private.is_admin, private.has_perm, private.shares_org to authenticated;

-- -----------------------------------------------------------------------------
-- Profil creat automat la înregistrare; e-mailul sincronizat cu auth.users
-- -----------------------------------------------------------------------------
create or replace function private.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profiles (id, email, full_name)
    values (
      new.id,
      lower(new.email),
      coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), '')
    );
  elsif new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_changed
  after insert or update of email on auth.users
  for each row execute function private.handle_auth_user();

-- -----------------------------------------------------------------------------
-- Reguli de integritate pentru roluri și membri
-- -----------------------------------------------------------------------------
create or replace function private.guard_roles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.is_system then
      raise exception 'system_role_delete' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' and new.is_system and current_user = 'authenticated' then
    raise exception 'system_role_create' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    if new.key <> old.key or new.is_system <> old.is_system or new.organization_id <> old.organization_id then
      raise exception 'role_key_immutable' using errcode = 'P0001';
    end if;
    if old.key = 'admin' and new.permissions <> old.permissions then
      raise exception 'admin_permissions_locked' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_roles before insert or update or delete on public.roles
  for each row execute function private.guard_roles();

create or replace function private.role_key(p_role uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select key from public.roles where id = p_role
$$;

-- Doar un administrator poate acorda/retrage rolul de administrator,
-- iar organizația trebuie să păstreze cel puțin un administrator activ.
create or replace function private.guard_memberships()
returns trigger
language plpgsql
security invoker -- invoker: current_user identifică apelul direct din client
set search_path = ''
as $$
declare
  v_org uuid := coalesce(new.organization_id, old.organization_id);
  v_touches_admin boolean;
  v_remaining int;
begin
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.organization_id <> old.organization_id) then
    raise exception 'membership_immutable' using errcode = 'P0001';
  end if;

  v_touches_admin :=
    (tg_op in ('UPDATE', 'DELETE') and private.role_key(old.role_id) = 'admin')
    or (tg_op in ('INSERT', 'UPDATE') and private.role_key(new.role_id) = 'admin');

  if v_touches_admin and current_user = 'authenticated' and not private.is_admin(v_org) then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  if tg_op in ('UPDATE', 'DELETE') and private.role_key(old.role_id) = 'admin' and old.status = 'active' then
    select count(*) into v_remaining
    from public.memberships m
    join public.roles r on r.id = m.role_id
    where m.organization_id = v_org
      and m.status = 'active'
      and r.key = 'admin'
      and m.id <> old.id;

    if v_remaining = 0
       and (tg_op = 'DELETE' or new.status <> 'active' or private.role_key(new.role_id) <> 'admin') then
      raise exception 'last_admin' using errcode = 'P0001';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger guard_memberships before insert or update or delete on public.memberships
  for each row execute function private.guard_memberships();

-- Invitațiile pentru rolul de administrator le poate trimite doar un administrator.
create or replace function private.guard_invitations()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if private.role_key(new.role_id) = 'admin'
     and current_user = 'authenticated'
     and not private.is_admin(new.organization_id) then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_invitations before insert or update on public.invitations
  for each row execute function private.guard_invitations();

-- -----------------------------------------------------------------------------
-- RPC: creare organizație (onboarding) și acceptare invitație
-- -----------------------------------------------------------------------------
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

  return v_admin_role;
end;
$$;

create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_org uuid;
  v_admin_role uuid;
  v_base text;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 120 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  if char_length(v_base) < 2 then
    v_base := 'org';
  end if;

  insert into public.organizations (name, slug)
  values (btrim(p_name), left(v_base, 50) || '-' || substr(md5(gen_random_uuid()::text), 1, 8))
  returning id into v_org;

  v_admin_role := private.seed_organization(v_org);

  insert into public.memberships (organization_id, user_id, role_id)
  values (v_org, v_user, v_admin_role);

  return v_org;
end;
$$;

create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_inv public.invitations;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_inv
  from public.invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if not found or v_inv.revoked_at is not null or v_inv.accepted_at is not null
     or v_inv.expires_at < now() then
    raise exception 'invitation_invalid' using errcode = 'P0002';
  end if;

  select lower(email) into v_email from auth.users where id = v_user;
  if v_email is distinct from v_inv.email then
    raise exception 'invitation_email_mismatch' using errcode = '42501';
  end if;

  insert into public.memberships (organization_id, user_id, role_id, status)
  values (v_inv.organization_id, v_user, v_inv.role_id, 'active')
  on conflict (organization_id, user_id)
  do update set role_id = excluded.role_id, status = 'active';

  if v_inv.team_id is not null then
    insert into public.team_members (organization_id, team_id, user_id)
    values (v_inv.organization_id, v_inv.team_id, v_user)
    on conflict do nothing;
  end if;

  update public.invitations
  set accepted_at = now(), accepted_by = v_user
  where id = v_inv.id;

  return v_inv.organization_id;
end;
$$;

-- Informații minime afișate pe pagina invitației, înainte de acceptare.
create or replace function public.get_invitation(p_token text)
returns table (organization_name text, email text, role_name text, expires_at timestamptz, is_valid boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, i.email, r.name, i.expires_at,
         (i.accepted_at is null and i.revoked_at is null and i.expires_at > now())
  from public.invitations i
  join public.organizations o on o.id = i.organization_id
  join public.roles r on r.id = i.role_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

revoke all on function public.create_organization, public.accept_invitation, public.get_invitation from public, anon;
grant execute on function public.create_organization, public.accept_invitation, public.get_invitation to authenticated;
-- Previzualizarea invitației e permisă și înainte de login (tokenul are 256 biți de entropie).
grant execute on function public.get_invitation to anon;
revoke all on function private.seed_organization, private.role_key from public;
grant execute on function private.role_key to authenticated; -- folosită de triggerele invoker

-- -----------------------------------------------------------------------------
-- Drepturi pe coloane + Row Level Security
-- -----------------------------------------------------------------------------
revoke all on public.organizations, public.profiles, public.roles, public.memberships,
  public.teams, public.team_members, public.invitations from anon, authenticated;

grant select on public.organizations, public.profiles, public.roles, public.memberships,
  public.teams, public.team_members, public.invitations to authenticated;

grant update (name, legal_name, fiscal_code, country, currency, timezone, default_locale, logo_path, settings)
  on public.organizations to authenticated;
grant update (full_name, phone, avatar_path, locale) on public.profiles to authenticated;
grant insert (organization_id, key, name, description, permissions), update (name, description, permissions), delete
  on public.roles to authenticated;
grant update (role_id, status, title), delete on public.memberships to authenticated;
grant insert (organization_id, name, manager_id), update (name, manager_id), delete on public.teams to authenticated;
grant insert (organization_id, team_id, user_id), delete on public.team_members to authenticated;
grant insert (organization_id, email, role_id, team_id, token_hash, invited_by, expires_at), update (revoked_at)
  on public.invitations to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.memberships enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.invitations enable row level security;

-- organizations
create policy "members read organization" on public.organizations
  for select to authenticated using (private.is_member(id));
create policy "settings.manage updates organization" on public.organizations
  for update to authenticated
  using (private.has_perm(id, 'settings.manage'))
  with check (private.has_perm(id, 'settings.manage'));

-- profiles
create policy "read own or co-member profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_org(id));
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- roles
create policy "members read roles" on public.roles
  for select to authenticated using (private.is_member(organization_id));
create policy "roles.manage inserts roles" on public.roles
  for insert to authenticated with check (private.has_perm(organization_id, 'roles.manage'));
create policy "roles.manage updates roles" on public.roles
  for update to authenticated
  using (private.has_perm(organization_id, 'roles.manage'))
  with check (private.has_perm(organization_id, 'roles.manage'));
create policy "roles.manage deletes roles" on public.roles
  for delete to authenticated using (private.has_perm(organization_id, 'roles.manage'));

-- memberships (crearea se face doar prin RPC)
create policy "members read memberships" on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_member(organization_id));
create policy "team.manage updates memberships" on public.memberships
  for update to authenticated
  using (private.has_perm(organization_id, 'team.manage'))
  with check (private.has_perm(organization_id, 'team.manage'));
create policy "team.manage deletes memberships" on public.memberships
  for delete to authenticated using (private.has_perm(organization_id, 'team.manage'));

-- teams
create policy "members read teams" on public.teams
  for select to authenticated using (private.is_member(organization_id));
create policy "team.manage inserts teams" on public.teams
  for insert to authenticated with check (private.has_perm(organization_id, 'team.manage'));
create policy "team.manage updates teams" on public.teams
  for update to authenticated
  using (private.has_perm(organization_id, 'team.manage'))
  with check (private.has_perm(organization_id, 'team.manage'));
create policy "team.manage deletes teams" on public.teams
  for delete to authenticated using (private.has_perm(organization_id, 'team.manage'));

-- team_members
create policy "members read team members" on public.team_members
  for select to authenticated using (private.is_member(organization_id));
create policy "team.manage inserts team members" on public.team_members
  for insert to authenticated with check (private.has_perm(organization_id, 'team.manage'));
create policy "team.manage deletes team members" on public.team_members
  for delete to authenticated using (private.has_perm(organization_id, 'team.manage'));

-- invitations (tokenul în clar nu se stochează niciodată)
create policy "team.manage reads invitations" on public.invitations
  for select to authenticated using (private.has_perm(organization_id, 'team.manage'));
create policy "team.manage creates invitations" on public.invitations
  for insert to authenticated
  with check (private.has_perm(organization_id, 'team.manage') and invited_by = (select auth.uid()));
create policy "team.manage revokes invitations" on public.invitations
  for update to authenticated
  using (private.has_perm(organization_id, 'team.manage'))
  with check (private.has_perm(organization_id, 'team.manage'));
