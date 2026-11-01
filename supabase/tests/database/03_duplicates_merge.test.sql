-- Teste pentru căutare, detectarea duplicatelor și unirea contactelor (Etapa 4).
begin;
select plan(14);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.logout() returns void language sql as $$
  reset role;
  select set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000b1', 'a@dup.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'g1@dup.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b3', 'g2@dup.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b4', 'x@dup.test', 'authenticated', 'authenticated');

create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;

select pg_temp.login_as('00000000-0000-0000-0000-0000000000b4');
select public.create_organization('Străin');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
insert into ctx values ('org', public.create_organization('Duplicate SRL'));
select pg_temp.logout();

insert into public.memberships (organization_id, user_id, role_id)
select (select v from ctx where k = 'org'), u.id, r.id
from (values ('00000000-0000-0000-0000-0000000000b2'::uuid), ('00000000-0000-0000-0000-0000000000b3'::uuid)) as u(id)
join public.roles r on r.organization_id = (select v from ctx where k = 'org') and r.key = 'agent';

-- Contacte create de admin: unul al agentului g2, două ale adminului (pentru unire).
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
with x as (insert into public.contacts (organization_id, first_name, last_name, owner_id)
  values ((select v from ctx where k = 'org'), 'Ștefan', 'Țurcan', '00000000-0000-0000-0000-0000000000b3') returning id)
insert into ctx select 'c_g2', id from x;
with x as (insert into public.contacts (organization_id, first_name, owner_id)
  values ((select v from ctx where k = 'org'), 'Păstrat', '00000000-0000-0000-0000-0000000000b1') returning id)
insert into ctx select 'keep', id from x;
with x as (insert into public.contacts (organization_id, first_name, position, owner_id)
  values ((select v from ctx where k = 'org'), 'Eliminat', 'Director', '00000000-0000-0000-0000-0000000000b1') returning id)
insert into ctx select 'remove', id from x;

insert into public.contact_identities (organization_id, contact_id, type, value) values
  ((select v from ctx where k = 'org'), (select v from ctx where k = 'c_g2'), 'phone', '+37369000111'),
  ((select v from ctx where k = 'org'), (select v from ctx where k = 'keep'), 'phone', '+37369000222'),
  ((select v from ctx where k = 'org'), (select v from ctx where k = 'remove'), 'phone', '+373 69 000 222'),
  ((select v from ctx where k = 'org'), (select v from ctx where k = 'remove'), 'email', 'eliminat@dup.test');

with x as (insert into public.leads (organization_id, title, pipeline_id, stage_id)
  select (select v from ctx where k = 'org'), 'Lead pentru unire', p.id, s.id
  from public.pipelines p join public.pipeline_stages s on s.pipeline_id = p.id and s.position = 1
  where p.organization_id = (select v from ctx where k = 'org') returning id)
insert into ctx select 'lead', id from x;
insert into public.lead_contacts (organization_id, lead_id, contact_id, is_primary)
values ((select v from ctx where k = 'org'), (select v from ctx where k = 'lead'), (select v from ctx where k = 'remove'), true);
insert into public.notes (organization_id, contact_id, body)
values ((select v from ctx where k = 'org'), (select v from ctx where k = 'remove'), 'Notă de mutat');

-- ---------------------------------------------------------------- căutare
select is((select search_text from public.contacts where id = (select v from ctx where k = 'c_g2')), 'stefan turcan',
  'search_text e fără diacritice și cu litere mici');

-- ---------------------------------------------------------------- duplicate
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b2');
select results_eq(
  $$ select full_name, is_visible from public.find_contact_duplicates(
       (select v from ctx where k = 'org'), '[{"type":"phone","value":"+373 69 000 111"}]'::jsonb) $$,
  $$ values (null::text, false) $$,
  'agentul e avertizat de duplicatul unui coleg, fără a-i vedea numele');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select is((select full_name from public.find_contact_duplicates(
             (select v from ctx where k = 'org'), '[{"type":"phone","value":"0037369000111"}]'::jsonb)),
  'Ștefan Țurcan', 'administratorul vede numele duplicatului');
select is((select count(*)::int from public.find_contact_duplicates(
             (select v from ctx where k = 'org'), '[{"type":"phone","value":"+37369000222"}]'::jsonb,
             (select v from ctx where k = 'keep'))), 1,
  'contactul editat este exclus din propriile duplicate');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000b4');
select throws_ok($$ select * from public.find_contact_duplicates((select v from ctx where k = 'org'), '[]'::jsonb) $$,
  '42501', 'forbidden', 'un utilizator din altă organizație nu poate căuta duplicate');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
insert into public.companies (organization_id, name) values ((select v from ctx where k = 'org'), 'Vinăria Țării');
select is((select count(*)::int from public.find_company_duplicates((select v from ctx where k = 'org'), 'VINARIA TARII')), 1,
  'companiile duplicate sunt găsite după denumire, fără diacritice');

-- ---------------------------------------------------------------- unire
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b2');
select throws_ok($$ select public.merge_contacts((select v from ctx where k = 'keep'), (select v from ctx where k = 'remove')) $$,
  '42501', 'forbidden', 'agentul nu poate uni contacte');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select public.merge_contacts((select v from ctx where k = 'keep'), (select v from ctx where k = 'keep')) $$,
  'P0001', 'merge_invalid', 'un contact nu poate fi unit cu el însuși');

select public.merge_contacts((select v from ctx where k = 'keep'), (select v from ctx where k = 'remove'));

select ok((select deleted_at is not null from public.contacts where id = (select v from ctx where k = 'remove')),
  'contactul unit e șters logic');
select results_eq(
  $$ select contact_id, is_primary from public.lead_contacts where lead_id = (select v from ctx where k = 'lead') $$,
  $$ values ((select v from ctx where k = 'keep'), true) $$,
  'lead-ul trece pe contactul păstrat, ca principal');
select is((select count(*)::int from public.notes where contact_id = (select v from ctx where k = 'keep')), 1,
  'notele se mută pe contactul păstrat');
select is((select count(*)::int from public.contact_identities where contact_id = (select v from ctx where k = 'keep')), 2,
  'identitățile se mută fără a dubla telefonul existent');
select is((select position from public.contacts where id = (select v from ctx where k = 'keep')), 'Director',
  'câmpurile goale ale contactului păstrat sunt completate');
select is((select count(*)::int from public.activities where contact_id = (select v from ctx where k = 'keep') and type = 'contact.merged'), 1,
  'unirea apare în cronologie');

select * from finish();
rollback;
