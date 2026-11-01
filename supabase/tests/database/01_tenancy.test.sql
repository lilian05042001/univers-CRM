-- Teste RLS + reguli de integritate pentru nucleul multi-tenant.
-- Rulare: npm run test:db  (necesită `supabase start`)
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

-- ---------------------------------------------------------------- utilitare
create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

create function pg_temp.logout() returns void language sql as $$
  reset role;
  select set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@tenancy.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@tenancy.test',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@tenancy.test', 'authenticated', 'authenticated');

select is((select count(*)::int from public.profiles where email like '%@tenancy.test'), 3,
  'profilurile sunt create automat la înregistrare');

-- ---------------------------------------------------------------- organizații
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
create temp table ids as select public.create_organization('Alpha SRL') as org_a;
grant all on ids to authenticated;

select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
create temp table ids_b as select public.create_organization('Beta SRL') as org_b;
grant all on ids_b to authenticated;

select is((select count(*)::int from public.organizations), 1, 'Bob vede doar organizația proprie');
select is((select count(*)::int from public.roles where organization_id = (select org_a from ids)), 0,
  'Bob nu vede rolurile altei organizații');
select is((select count(*)::int from public.memberships where organization_id = (select org_a from ids)), 0,
  'Bob nu vede membrii altei organizații');

update public.organizations set name = 'Piratat' where id = (select org_a from ids);
select pg_temp.logout();
select is((select name from public.organizations where id = (select org_a from ids)), 'Alpha SRL',
  'Bob nu poate modifica altă organizație');

select is((select count(*)::int from public.roles where organization_id = (select org_a from ids) and is_system), 3,
  'organizația nouă primește rolurile Administrator, Manager, Agent');

-- ---------------------------------------------------------------- invitații
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
insert into public.invitations (organization_id, email, role_id, token_hash, invited_by)
select org_a, 'carol@tenancy.test', r.id, encode(extensions.digest('token-pentru-carol-0000000000', 'sha256'), 'hex'),
       '00000000-0000-0000-0000-00000000000a'
from ids join public.roles r on r.organization_id = ids.org_a and r.key = 'agent';

select pg_temp.login_as('00000000-0000-0000-0000-00000000000b');
select throws_ok($$ select public.accept_invitation('token-pentru-carol-0000000000') $$,
  '42501', 'invitation_email_mismatch', 'invitația nu poate fi folosită de alt cont');

select pg_temp.login_as('00000000-0000-0000-0000-00000000000c');
select is(public.accept_invitation('token-pentru-carol-0000000000'), (select org_a from ids),
  'Carol acceptă invitația');
select throws_ok($$ select public.accept_invitation('token-pentru-carol-0000000000') $$,
  'P0002', 'invitation_invalid', 'invitația nu poate fi refolosită');
select is((select count(*)::int from public.organizations), 1, 'Carol vede organizația în care a intrat');

-- ---------------------------------------------------------------- permisiuni agent
update public.organizations set name = 'Schimbat de agent' where id = (select org_a from ids);
select is((select count(*)::int from public.organizations where name = 'Schimbat de agent'), 0,
  'agentul nu poate modifica setările companiei');

select throws_ok($$
  insert into public.invitations (organization_id, email, role_id, token_hash, invited_by)
  select org_a, 'x@tenancy.test', r.id, repeat('a', 64), '00000000-0000-0000-0000-00000000000c'
  from ids join public.roles r on r.organization_id = ids.org_a and r.key = 'agent'
$$, '42501', null, 'agentul nu poate trimite invitații');

select is((select count(*)::int from public.invitations), 0, 'agentul nu vede invitațiile');

-- ---------------------------------------------------------------- escaladare de privilegii
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
insert into public.roles (organization_id, key, name, permissions)
select org_a, 'hr', 'HR', array['team.manage'] from ids;
update public.memberships set role_id = (select id from public.roles where key = 'hr' and organization_id = (select org_a from ids))
where user_id = '00000000-0000-0000-0000-00000000000c';

select pg_temp.login_as('00000000-0000-0000-0000-00000000000c');
select throws_ok($$
  update public.memberships
  set role_id = (select id from public.roles where key = 'admin' and organization_id = (select org_a from ids))
  where user_id = '00000000-0000-0000-0000-00000000000c'
$$, '42501', 'admin_only', 'un membru cu team.manage nu se poate face administrator');

select throws_ok($$
  update public.memberships set status = 'disabled' where user_id = '00000000-0000-0000-0000-00000000000a'
$$, '42501', 'admin_only', 'un non-admin nu poate dezactiva administratorul');

-- RLS pe UPDATE nu aruncă eroare: rândurile nepermise pur și simplu nu sunt modificate.
update public.roles set permissions = array['team.manage', 'settings.manage'] where key = 'hr';
select is((select permissions from public.roles where key = 'hr'), array['team.manage'],
  'fără roles.manage nu se pot modifica permisiunile rolurilor');

-- ---------------------------------------------------------------- reguli administrator
select pg_temp.login_as('00000000-0000-0000-0000-00000000000a');
select throws_ok($$
  update public.memberships set status = 'disabled' where user_id = '00000000-0000-0000-0000-00000000000a'
$$, 'P0001', 'last_admin', 'ultimul administrator nu poate fi dezactivat');

select throws_ok($$
  delete from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a'
$$, 'P0001', 'last_admin', 'ultimul administrator nu poate fi eliminat');

select throws_ok($$ update public.roles set permissions = '{}' where key = 'admin' $$,
  'P0001', 'admin_permissions_locked', 'permisiunile administratorului sunt fixe');

select throws_ok($$ delete from public.roles where key = 'agent' $$,
  'P0001', 'system_role_delete', 'rolurile de sistem nu pot fi șterse');

select throws_ok($$ update public.roles set permissions = array['nu.exista'] where key = 'hr' $$,
  '23514', null, 'permisiunile trebuie să existe în catalog');

-- ---------------------------------------------------------------- integritate între organizații
select throws_ok($$
  insert into public.teams (organization_id, name, manager_id)
  select org_a, 'Vânzări', '00000000-0000-0000-0000-00000000000b' from ids
$$, '23503', null, 'managerul unei echipe trebuie să fie membru al organizației');

select pg_temp.logout();
set local role anon;
select is((select count(*)::int from public.get_invitation('token-inexistent')), 0,
  'previzualizarea invitației funcționează pentru vizitatori, fără a expune date');

select * from finish();
rollback;
