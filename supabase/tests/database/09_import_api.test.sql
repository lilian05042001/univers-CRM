-- Teste pentru import și chei API (Etapa 11): RLS pe joburi, loturi cu erori pe rând, duplicate,
-- finalizare, chei API (hash ascuns, revocare definitivă), autentificarea cheii, drepturile service_role.
begin;
select plan(25);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.logout() returns void language sql as $$
  reset role;
  select set_config('request.jwt.claims', '', true);
$$;

-- a = admin, m = manager (fără data.import), x = admin în altă organizație
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'a@imp.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'm@imp.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'x@imp.test', 'authenticated', 'authenticated');

create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated, service_role;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ctx where k = p_key $$;

select pg_temp.login_as('00000000-0000-0000-0000-0000000000c1');
insert into ctx values ('org', public.create_organization('Import SRL'));
select pg_temp.login_as('00000000-0000-0000-0000-0000000000c3');
insert into ctx values ('other', public.create_organization('Alta SRL'));
select pg_temp.logout();
insert into public.memberships (organization_id, user_id, role_id)
select pg_temp.id('org'), '00000000-0000-0000-0000-0000000000c2', id
from public.roles where organization_id = pg_temp.id('org') and key = 'manager';
insert into public.tags (organization_id, name) values (pg_temp.id('org'), 'VIP');

-- Contact existent: telefonul lui face din rândul 4 un duplicat.
insert into public.contacts (id, organization_id, first_name) values ('00000000-0000-0000-0000-00000000c0c0', pg_temp.id('org'), 'Existent');
insert into public.contact_identities (organization_id, contact_id, type, value, is_primary)
values (pg_temp.id('org'), '00000000-0000-0000-0000-00000000c0c0', 'phone', '+37369000001', true);

-- ---------------------------------------------------------------- joburi: cine le poate crea / vedea
select pg_temp.login_as('00000000-0000-0000-0000-0000000000c2');
select throws_ok(
  $$ insert into public.import_jobs (organization_id, entity, file_name, total_rows)
     values ((select v from ctx where k = 'org'), 'contacts', 'a.csv', 1) $$,
  '42501', null, 'fără data.import nu se poate crea un import');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000c1');
insert into public.import_jobs (organization_id, entity, file_name, total_rows, options)
values (pg_temp.id('org'), 'contacts', 'contacte.csv', 7,
        jsonb_build_object('skip_duplicates', true, 'create_companies', true,
                           'default_owner_id', '00000000-0000-0000-0000-0000000000c1'));
insert into ctx select 'job', id from public.import_jobs where file_name = 'contacte.csv';
select is((select created_by from public.import_jobs where id = pg_temp.id('job')),
          '00000000-0000-0000-0000-0000000000c1'::uuid, 'autorul jobului e setat automat');
select throws_ok(
  $$ update public.import_jobs set ok_count = 100 where id = (select v from ctx where k = 'job') $$,
  '42501', null, 'contoarele nu se pot modifica direct');

-- ---------------------------------------------------------------- un lot cu rânduri bune și greșite
select is(
  public.import_rows(pg_temp.id('job'), $$[
    {"row": 2, "first_name": "Ion", "last_name": "Popa", "phones": ["+37369111111"], "emails": ["ion@x.md"],
     "company": "Alfa SRL", "source": "website", "tags": ["vip"], "city": "Chișinău"},
    {"row": 3, "first_name": "Ana", "phones": ["+37369222222"], "company": "alfa srl", "owner": "m@imp.test"},
    {"row": 4, "first_name": "Dublura", "phones": ["+373 690 00001"]},
    {"row": 5, "first_name": "Necunoscut", "owner": "nimeni@imp.test"},
    {"row": 6, "first_name": "Eticheta", "tags": ["inexistenta"]}
  ]$$::jsonb, $$[{"row": 7, "code": "validation.email", "field": "emails"}]$$::jsonb),
  '{"ok": 2, "failed": 3, "skipped": 1}'::jsonb,
  'lotul: 2 importate, 1 duplicat sărit, 2 respinse în SQL + 1 la validare');

select results_eq(
  $$ select processed_rows, ok_count, skipped_count, failed_count from public.import_jobs
     where id = (select v from ctx where k = 'job') $$,
  $$ values (6, 2, 1, 3) $$, 'contoarele jobului');
select is(
  (select jsonb_agg(e ->> 'code') from public.import_jobs, jsonb_array_elements(errors) e
   where id = pg_temp.id('job')),
  '["duplicate", "unknown_owner", "unknown_tag", "validation.email"]'::jsonb,
  'raportul de erori, în ordinea rândurilor');
select is((select count(*)::int from public.contacts where organization_id = pg_temp.id('org') and deleted_at is null),
          3, 'rândurile respinse nu lasă contacte parțiale');
select is((select count(*)::int from public.companies where organization_id = pg_temp.id('org')),
          1, 'compania e creată o singură dată și refolosită după nume');
select results_eq(
  $$ select c.owner_id, s.name, c.address ->> 'city', (select count(*)::int from public.contact_tags t where t.contact_id = c.id)
     from public.contacts c join public.lead_sources s on s.id = c.source_id where c.first_name = 'Ion' $$,
  $$ values ('00000000-0000-0000-0000-0000000000c1'::uuid, 'Website'::text, 'Chișinău'::text, 1) $$,
  'responsabilul implicit, sursa și eticheta (fără majuscule), orașul');
select is((select owner_id from public.contacts where first_name = 'Ana'),
          '00000000-0000-0000-0000-0000000000c2'::uuid, 'responsabilul după e-mail');
select is((select count(*)::int from public.activities a join public.contacts c on c.id = a.contact_id
           where c.first_name in ('Ion', 'Ana') and a.type = 'contact.created'), 2,
          'contactele importate apar în cronologie');

-- ---------------------------------------------------------------- doar autorul continuă jobul
select pg_temp.login_as('00000000-0000-0000-0000-0000000000c3');
select throws_ok($$ select public.import_rows((select v from ctx where k = 'job'), '[]'::jsonb) $$,
  '42501', null, 'alt utilizator nu poate adăuga rânduri în job');
select is_empty($$ select 1 from public.import_jobs where id = (select v from ctx where k = 'job') $$,
  'jobul nu e vizibil din altă organizație');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000c1');
select lives_ok($$ select public.finish_import((select v from ctx where k = 'job'), 'done') $$, 'finalizarea jobului');
select throws_ok($$ select public.import_rows((select v from ctx where k = 'job'), '[]'::jsonb) $$,
  'import_finished', 'un job finalizat nu mai primește rânduri');

-- ---------------------------------------------------------------- chei API
insert into public.api_keys (organization_id, name, key_prefix, key_hash, scopes)
values (pg_temp.id('org'), 'ERP', 'ucrm_abcd1234', repeat('a', 64), array['contacts:read', 'leads:write']);
insert into ctx select 'key', id from public.api_keys where name = 'ERP';
select throws_ok($$ select key_hash from public.api_keys $$, '42501', null, 'hash-ul cheii nu se poate citi');
select throws_ok(
  $$ insert into public.api_keys (organization_id, name, key_prefix, key_hash, scopes)
     values ((select v from ctx where k = 'org'), 'Rău', 'ucrm_x0000000', repeat('b', 64), array['admin']) $$,
  '23514', null, 'doar scope-uri cunoscute');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000c2');
select is_empty($$ select 1 from public.api_keys $$, 'managerul nu vede cheile API');
select throws_ok($$ select * from public.authenticate_api_key(repeat('a', 64)) $$,
  '42501', null, 'autentificarea cheii e rezervată serverului (service_role)');
select pg_temp.logout();

set local role service_role;
select results_eq($$ select organization_id, scopes from public.authenticate_api_key(repeat('a', 64)) $$,
  $$ values ((select v from ctx where k = 'org'), array['contacts:read', 'leads:write']) $$,
  'cheia validă întoarce organizația și scope-urile');

-- API-ul (service_role) creează un contact cu identitate și un lead legat de el.
insert into public.contacts (id, organization_id, first_name, created_by)
values ('00000000-0000-0000-0000-00000000c0c1', pg_temp.id('org'), 'Din API', '00000000-0000-0000-0000-0000000000c1');
insert into public.contact_identities (organization_id, contact_id, type, value, is_primary)
values (pg_temp.id('org'), '00000000-0000-0000-0000-00000000c0c1', 'email', 'api@x.md', true);
insert into public.leads (id, organization_id, title, pipeline_id, stage_id, created_by)
select '00000000-0000-0000-0000-00000000c0c2', pg_temp.id('org'), 'Lead API', p.id, s.id, '00000000-0000-0000-0000-0000000000c1'
from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id and s.position = 1
where p.organization_id = pg_temp.id('org');
insert into public.lead_contacts (organization_id, lead_id, contact_id, is_primary)
values (pg_temp.id('org'), '00000000-0000-0000-0000-00000000c0c2', '00000000-0000-0000-0000-00000000c0c1', true);
reset role;
select results_eq(
  $$ select l.currency::text, l.status::text, (select count(*)::int from public.lead_stage_history h where h.lead_id = l.id)
     from public.leads l where l.id = '00000000-0000-0000-0000-00000000c0c2' $$,
  $$ values ('MDL', 'open', 1) $$, 'lead-ul creat de API: moneda organizației, stare, istoric');

-- Worker: evenimentele fără automatizări se finalizează dintr-un singur apel (doar service_role).
create temp table ev as
  select id from public.domain_events where organization_id = pg_temp.id('org') and type = 'contact.created';
grant select on ev to service_role;
set local role service_role;
select lives_ok($$ select public.complete_domain_events(array(select id from ev)) $$,
  'service_role finalizează evenimentele în bloc');
reset role;
select is((select count(*)::int from public.domain_events
           where organization_id = pg_temp.id('org') and type = 'contact.created' and processed_at is null), 0,
          'evenimentele contact.created ale importului sunt finalizate');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000c1');
update public.api_keys set revoked_at = now() where id = pg_temp.id('key');
select throws_ok($$ update public.api_keys set revoked_at = null where id = (select v from ctx where k = 'key') $$,
  'api_key_revoked', 'revocarea e definitivă');
select pg_temp.logout();
set local role service_role;
select is_empty($$ select * from public.authenticate_api_key(repeat('a', 64)) $$, 'cheia revocată nu mai e valabilă');
reset role;

select * from finish();
rollback;
