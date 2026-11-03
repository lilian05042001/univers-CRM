-- =============================================================================
-- Etapa 12 · Performanța RLS: datele utilizatorului curent (organizații, drepturi,
-- echipe) se calculează o singură dată per interogare, nu pentru fiecare rând.
--
-- Funcțiile security definer (is_member, has_perm, can_see_record…) nu pot fi integrate
-- în planul interogării, așa că în politici rulau câte o subinterogare pe rând
-- (10 000 de contacte: 1,8 s la un simplu count). Politicile folosesc acum
-- `coloană = ANY ((SELECT private.my_…())::uuid[])`: subinterogarea fără parametri de rând
-- devine un InitPlan, evaluat o dată. Funcțiile vechi rămân pentru RPC-uri și triggere.
-- =============================================================================

-- Organizațiile în care utilizatorul curent e membru activ.
create or replace function private.my_org_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.organization_id), '{}')
  from public.memberships m
  where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

create or replace function private.my_admin_org_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.organization_id), '{}')
  from public.memberships m
  join public.roles r on r.id = m.role_id
  where m.user_id = (select auth.uid()) and m.status = 'active' and r.key = 'admin'
$$;

-- Organizațiile în care utilizatorul are permisiunea (administratorul le are pe toate).
create or replace function private.my_perm_org_ids(p_perm text)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.organization_id), '{}')
  from public.memberships m
  join public.roles r on r.id = m.role_id
  where m.user_id = (select auth.uid()) and m.status = 'active'
    and (r.key = 'admin' or p_perm = any (r.permissions))
$$;

-- Vizibilitatea CRM: 'all' (admin / crm.view.all) sau 'team' (crm.view.team), ca private.crm_scope.
create or replace function private.my_scope_org_ids(p_scope text)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(m.organization_id), '{}')
  from public.memberships m
  join public.roles r on r.id = m.role_id
  where m.user_id = (select auth.uid()) and m.status = 'active'
    and case p_scope
          when 'all' then r.key = 'admin' or 'crm.view.all' = any (r.permissions)
          when 'team' then 'crm.view.team' = any (r.permissions)
          else false
        end
$$;

-- Echipele utilizatorului (membru sau manager), din toate organizațiile.
create or replace function private.my_team_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct t.id), '{}')
  from public.teams t
  left join public.team_members tm on tm.team_id = t.id
  where t.manager_id = (select auth.uid()) or tm.user_id = (select auth.uid())
$$;

-- Colegii de echipă ca „organizație/utilizator” (un coleg dintr-o organizație nu dă acces în alta).
create or replace function private.my_team_peer_keys()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct t.organization_id::text || '/' || x.u::text), '{}')
  from public.teams t
  left join public.team_members tm on tm.team_id = t.id
  cross join lateral (values (tm.user_id), (t.manager_id)) as x(u)
  where t.id = any (private.my_team_ids()) and x.u is not null
$$;

-- Utilizatorii cu care împart cel puțin o organizație (inclusiv eu), ca private.shares_org.
create or replace function private.my_colleague_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct other.user_id), '{}')
  from public.memberships me
  join public.memberships other on other.organization_id = me.organization_id
  where me.user_id = (select auth.uid()) and me.status = 'active'
$$;

revoke all on function private.my_org_ids, private.my_admin_org_ids, private.my_perm_org_ids,
  private.my_scope_org_ids, private.my_team_ids, private.my_team_peer_keys, private.my_colleague_ids from public;
grant execute on function private.my_org_ids, private.my_admin_org_ids, private.my_perm_org_ids,
  private.my_scope_org_ids, private.my_team_ids, private.my_team_peer_keys, private.my_colleague_ids
  to authenticated;

-- -----------------------------------------------------------------------------
-- Rescrierea politicilor: fiecare apel e înlocuit cu expresia echivalentă.
-- -----------------------------------------------------------------------------
create function pg_temp.in_set(p_value text, p_fn text) returns text language sql immutable as $$
  select format('(%s = ANY ((SELECT private.%s)::uuid[]))', p_value, p_fn)
$$;

-- can_see_record(org, responsabil, echipă): toate | proprii + nealocate | + colegii / echipele mele.
create function pg_temp.see(p_org text, p_owner text, p_team text) returns text language sql immutable as $$
  select format(
    '(%s OR (%s AND (%s IS NULL OR %s = (SELECT auth.uid()) OR (%s AND ((%s::text || ''/'' || %s::text) = ANY ((SELECT private.my_team_peer_keys())::text[])%s)))))',
    pg_temp.in_set(p_org, 'my_scope_org_ids(''all''::text)'),
    pg_temp.in_set(p_org, 'my_org_ids()'),
    p_owner, p_owner,
    pg_temp.in_set(p_org, 'my_scope_org_ids(''team''::text)'),
    p_org, p_owner,
    case when p_team = 'NULL::uuid' then '' else ' OR ' || pg_temp.in_set(p_team, 'my_team_ids()') end)
$$;

create function pg_temp.parents(p_table text, p_lead text, p_contact text, p_company text)
returns text language sql immutable as $$
  select format('(%s AND %s AND %s)',
    case when p_lead = 'NULL::uuid' then 'true' else format(
      '(%1$I.%2$I IS NULL OR EXISTS (SELECT 1 FROM public.leads p WHERE p.id = %1$I.%2$I))', p_table, p_lead) end,
    case when p_contact = 'NULL::uuid' then 'true' else format(
      '(%1$I.%2$I IS NULL OR EXISTS (SELECT 1 FROM public.contacts p WHERE p.id = %1$I.%2$I))', p_table, p_contact) end,
    case when p_company = 'NULL::uuid' then 'true' else format(
      '(%1$I.%2$I IS NULL OR EXISTS (SELECT 1 FROM public.companies p WHERE p.id = %1$I.%2$I))', p_table, p_company) end)
$$;

create function pg_temp.rewrite(p_table text, p_expr text) returns text language plpgsql as $$
declare
  e text := p_expr;
  m text[];
  arg constant text := '([a-z_]+|NULL::uuid)';
begin
  if e is null then
    return null;
  end if;

  loop
    m := regexp_match(e, 'private\.can_see_conversation\(' || arg || ', ' || arg || '\)');
    exit when m is null;
    e := replace(e, format('private.can_see_conversation(%s, %s)', m[1], m[2]),
      format('(%s OR %s)', pg_temp.in_set(m[1], 'my_perm_org_ids(''inbox.view.all''::text)'),
             pg_temp.see(m[1], m[2], 'NULL::uuid')));
  end loop;

  loop
    m := regexp_match(e, 'private\.can_read_automations\(' || arg || '\)');
    exit when m is null;
    e := replace(e, format('private.can_read_automations(%s)', m[1]),
      format('(%s OR %s OR %s)', pg_temp.in_set(m[1], 'my_perm_org_ids(''automations.manage''::text)'),
             pg_temp.in_set(m[1], 'my_scope_org_ids(''all''::text)'),
             pg_temp.in_set(m[1], 'my_scope_org_ids(''team''::text)')));
  end loop;

  loop
    m := regexp_match(e, 'private\.can_see_record\(' || arg || ', ' || arg || ', ' || arg || '\)');
    exit when m is null;
    e := replace(e, format('private.can_see_record(%s, %s, %s)', m[1], m[2], m[3]), pg_temp.see(m[1], m[2], m[3]));
  end loop;

  loop
    m := regexp_match(e, 'private\.parents_visible\(' || arg || ', ' || arg || ', ' || arg || '\)');
    exit when m is null;
    e := replace(e, format('private.parents_visible(%s, %s, %s)', m[1], m[2], m[3]),
      pg_temp.parents(p_table, m[1], m[2], m[3]));
  end loop;

  loop
    m := regexp_match(e, 'private\.has_perm\(' || arg || ', (''[a-z_.]+''::text)\)');
    exit when m is null;
    e := replace(e, format('private.has_perm(%s, %s)', m[1], m[2]),
      pg_temp.in_set(m[1], format('my_perm_org_ids(%s)', m[2])));
  end loop;

  loop
    m := regexp_match(e, 'private\.is_admin\(' || arg || '\)');
    exit when m is null;
    e := replace(e, format('private.is_admin(%s)', m[1]), pg_temp.in_set(m[1], 'my_admin_org_ids()'));
  end loop;

  loop
    m := regexp_match(e, 'private\.is_member\(' || arg || '\)');
    exit when m is null;
    e := replace(e, format('private.is_member(%s)', m[1]), pg_temp.in_set(m[1], 'my_org_ids()'));
  end loop;

  loop
    m := regexp_match(e, 'private\.shares_org\(' || arg || '\)');
    exit when m is null;
    e := replace(e, format('private.shares_org(%s)', m[1]), pg_temp.in_set(m[1], 'my_colleague_ids()'));
  end loop;

  return e;
end;
$$;

do $$
declare
  p record;
  v_using text;
  v_check text;
begin
  for p in select * from pg_policies where schemaname = 'public' loop
    v_using := pg_temp.rewrite(p.tablename, p.qual);
    v_check := pg_temp.rewrite(p.tablename, p.with_check);
    continue when v_using is not distinct from p.qual and v_check is not distinct from p.with_check;

    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format('create policy %I on public.%I as %s for %s to %s%s%s',
      p.policyname, p.tablename, p.permissive, p.cmd,
      (select string_agg(quote_ident(r), ', ') from unnest(p.roles) r),
      case when v_using is not null then format(' using (%s)', v_using) else '' end,
      case when v_check is not null then format(' with check (%s)', v_check) else '' end);
  end loop;

  -- Nicio politică nu mai apelează funcțiile evaluate pe rând.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and concat(qual, ' ', with_check) ~ 'private\.(is_member|is_admin|has_perm|can_see_record|can_see_conversation|can_read_automations|parents_visible|shares_org)\('
  ) then
    raise exception 'rls rewrite incomplete';
  end if;
end;
$$;
