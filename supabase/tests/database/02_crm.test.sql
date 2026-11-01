-- Teste RLS + reguli de business pentru entitățile CRM (Etapa 3).
begin;
select plan(31);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.logout() returns void language sql as $$
  reset role;
  select set_config('request.jwt.claims', '', true);
$$;

-- a = admin, m = manager, g1/g2 = agenți (g1 în echipa managerului), x = admin în altă organizație
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@crm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'm@crm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'g1@crm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a4', 'g2@crm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a5', 'x@crm.test', 'authenticated', 'authenticated');

create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a5');
insert into ctx values ('org_x', public.create_organization('Altă Firmă'));
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
insert into ctx values ('org', public.create_organization('Test CRM'));
select pg_temp.logout();

insert into public.memberships (organization_id, user_id, role_id)
select (select v from ctx where k = 'org'), u.id, r.id
from (values ('00000000-0000-0000-0000-0000000000a2'::uuid, 'manager'),
             ('00000000-0000-0000-0000-0000000000a3'::uuid, 'agent'),
             ('00000000-0000-0000-0000-0000000000a4'::uuid, 'agent')) as u(id, role_key)
join public.roles r on r.organization_id = (select v from ctx where k = 'org') and r.key = u.role_key;

with x as (insert into public.teams (organization_id, name, manager_id)
  values ((select v from ctx where k = 'org'), 'Echipa', '00000000-0000-0000-0000-0000000000a2') returning id)
insert into ctx select 'team', id from x;
insert into public.team_members (organization_id, team_id, user_id)
values ((select v from ctx where k = 'org'), (select v from ctx where k = 'team'), '00000000-0000-0000-0000-0000000000a3');

insert into ctx select 'pipeline', id from public.pipelines where organization_id = (select v from ctx where k = 'org');
insert into ctx select 'stage_new', id from public.pipeline_stages where pipeline_id = (select v from ctx where k = 'pipeline') and position = 1;
insert into ctx select 'stage_won', id from public.pipeline_stages where pipeline_id = (select v from ctx where k = 'pipeline') and kind = 'won';
insert into ctx select 'stage_lost', id from public.pipeline_stages where pipeline_id = (select v from ctx where k = 'pipeline') and kind = 'lost';

-- ---------------------------------------------------------------- configurare implicită
select is((select count(*)::int from public.pipeline_stages where pipeline_id = (select v from ctx where k = 'pipeline')), 8,
  'organizația nouă are pipeline-ul implicit cu 8 etape');
select is((select count(*)::int from public.lead_sources where organization_id = (select v from ctx where k = 'org')), 8,
  'organizația nouă are 8 surse de lead-uri');
select is((select count(*)::int from public.task_types where organization_id = (select v from ctx where k = 'org') and is_system), 6,
  'organizația nouă are cele 6 tipuri de activități de sistem');
select is((select currency::text from public.organizations where id = (select v from ctx where k = 'org')), 'MDL',
  'moneda implicită este MDL');

-- ---------------------------------------------------------------- lead-uri create de admin
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
with x as (insert into public.leads (organization_id, title, pipeline_id, stage_id, value, responsible_id, team_id)
  values ((select v from ctx where k = 'org'), 'Lead G1', (select v from ctx where k = 'pipeline'), (select v from ctx where k = 'stage_new'), 5000,
          '00000000-0000-0000-0000-0000000000a3', (select v from ctx where k = 'team')) returning id)
insert into ctx select 'l_g1', id from x;
with x as (insert into public.leads (organization_id, title, pipeline_id, stage_id, value, responsible_id)
  values ((select v from ctx where k = 'org'), 'Lead G2', (select v from ctx where k = 'pipeline'), (select v from ctx where k = 'stage_new'), 7000,
          '00000000-0000-0000-0000-0000000000a4') returning id)
insert into ctx select 'l_g2', id from x;
with x as (insert into public.leads (organization_id, title, pipeline_id, stage_id)
  values ((select v from ctx where k = 'org'), 'Lead nealocat', (select v from ctx where k = 'pipeline'), (select v from ctx where k = 'stage_new')) returning id)
insert into ctx select 'l_free', id from x;
with x as (insert into public.leads (organization_id, title, pipeline_id, stage_id, responsible_id)
  values ((select v from ctx where k = 'org'), 'Lead manager', (select v from ctx where k = 'pipeline'), (select v from ctx where k = 'stage_new'),
          '00000000-0000-0000-0000-0000000000a2') returning id)
insert into ctx select 'l_m', id from x;

select is((select count(*)::int from public.leads), 4, 'administratorul vede toate lead-urile');
select is((select currency::text from public.leads where id = (select v from ctx where k = 'l_g1')), 'MDL',
  'lead-ul preia moneda organizației');

-- ---------------------------------------------------------------- vizibilitate pe rol
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from public.leads), 2, 'agentul vede doar lead-urile proprii și pe cele nealocate');
select is((select count(*)::int from public.leads where id = (select v from ctx where k = 'l_g2')), 0,
  'agentul nu vede lead-ul altui agent');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.leads), 3, 'managerul vede lead-urile echipei, nealocate și proprii');
select is((select count(*)::int from public.leads where id = (select v from ctx where k = 'l_g2')), 0,
  'managerul nu vede lead-ul unui agent din afara echipei');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from public.leads), 0, 'altă organizație nu vede niciun lead');
select throws_ok($$
  insert into public.leads (organization_id, title, pipeline_id, stage_id)
  select (select v from ctx where k = 'org'), 'Intrus', (select v from ctx where k = 'pipeline'), (select v from ctx where k = 'stage_new')
$$, '42501', null, 'altă organizație nu poate crea lead-uri aici');

-- ---------------------------------------------------------------- permisiuni agent
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$
  update public.leads set responsible_id = '00000000-0000-0000-0000-0000000000a4' where id = (select v from ctx where k = 'l_g1')
$$, '42501', 'assign_forbidden', 'agentul nu poate atribui lead-ul altcuiva');

delete from public.leads where id = (select v from ctx where k = 'l_g1');
select is((select count(*)::int from public.leads where id = (select v from ctx where k = 'l_g1')), 1,
  'agentul nu poate șterge lead-uri');
select throws_ok($$ update public.leads set deleted_at = now() where id = (select v from ctx where k = 'l_g1') $$,
  '42501', 'forbidden', 'agentul nu poate șterge logic lead-uri');
select throws_ok($$
  insert into public.pipelines (organization_id, name) select (select v from ctx where k = 'org'), 'Pipeline agent'
$$, '42501', null, 'agentul nu poate configura pipeline-uri');

-- ---------------------------------------------------------------- etape, status, istoric
update public.leads set stage_id = (select v from ctx where k = 'stage_won') where id = (select v from ctx where k = 'l_g1');
select results_eq(
  $$ select status::text, closed_at is not null, won_amount from public.leads where id = (select v from ctx where k = 'l_g1') $$,
  $$ values ('won', true, 5000.00::numeric(14,2)) $$,
  'mutarea în „Câștigat” setează statusul, data închiderii și suma realizată');
select is((select count(*)::int from public.lead_stage_history where lead_id = (select v from ctx where k = 'l_g1')), 2,
  'istoricul etapelor păstrează crearea și mutarea');
select ok((select time_in_previous is not null from public.lead_stage_history
           where lead_id = (select v from ctx where k = 'l_g1') and from_stage_id is not null),
  'istoricul calculează timpul petrecut în etapa anterioară');
select is((select count(*)::int from public.activities where lead_id = (select v from ctx where k = 'l_g1') and type = 'lead.stage_changed'), 1,
  'schimbarea etapei apare în cronologie');

update public.leads set stage_id = (select v from ctx where k = 'stage_new') where id = (select v from ctx where k = 'l_g1');
select results_eq(
  $$ select status::text, closed_at, won_amount from public.leads where id = (select v from ctx where k = 'l_g1') $$,
  $$ values ('open', null::timestamptz, null::numeric(14,2)) $$,
  'redeschiderea lead-ului golește datele de închidere');

select throws_ok($$ select count(*) from public.domain_events $$, '42501', null,
  'clientul nu are acces la outbox-ul de evenimente');

-- ---------------------------------------------------------------- sarcini, note, cronologie
with x as (insert into public.tasks (organization_id, type_id, title, responsible_id, lead_id, due_at)
  select (select v from ctx where k = 'org'), tt.id, 'Sună clientul', '00000000-0000-0000-0000-0000000000a3',
         (select v from ctx where k = 'l_g1'), now() + interval '1 day'
  from public.task_types tt where tt.organization_id = (select v from ctx where k = 'org') and tt.key = 'call' returning id)
insert into ctx select 'task', id from x;
select ok((select next_task_due_at is not null from public.leads where id = (select v from ctx where k = 'l_g1')),
  'lead-ul arată următoarea activitate');

update public.tasks set status = 'done', result = 'Clientul a confirmat' where id = (select v from ctx where k = 'task');
select results_eq(
  $$ select next_task_due_at is null, (select count(*)::int from public.activities a where a.lead_id = l.id and a.type = 'task.completed')
     from public.leads l where l.id = (select v from ctx where k = 'l_g1') $$,
  $$ values (true, 1) $$,
  'finalizarea sarcinii actualizează lead-ul și cronologia');

insert into public.notes (organization_id, lead_id, body)
values ((select v from ctx where k = 'org'), (select v from ctx where k = 'l_g1'), 'Notă internă');
select is((select created_by from public.notes where lead_id = (select v from ctx where k = 'l_g1')),
  '00000000-0000-0000-0000-0000000000a3'::uuid, 'autorul notei e setat automat');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a4');
select is((select count(*)::int from public.notes), 0, 'notele unui lead invizibil nu sunt vizibile');
select is((select count(*)::int from public.activities where lead_id = (select v from ctx where k = 'l_g1')), 0,
  'cronologia unui lead invizibil nu e vizibilă');

-- ---------------------------------------------------------------- integritate
select pg_temp.login_as('00000000-0000-0000-0000-0000000000a1');
with x as (insert into public.pipelines (organization_id, name)
  values ((select v from ctx where k = 'org'), 'Parteneri') returning id)
insert into ctx select 'pipeline2', id from x;
with x as (insert into public.pipeline_stages (organization_id, pipeline_id, name)
  values ((select v from ctx where k = 'org'), (select v from ctx where k = 'pipeline2'), 'Nou') returning id)
insert into ctx select 'stage_p2', id from x;
select throws_ok($$
  insert into public.leads (organization_id, title, pipeline_id, stage_id)
  select (select v from ctx where k = 'org'), 'Greșit', (select v from ctx where k = 'pipeline'), (select v from ctx where k = 'stage_p2')
$$, '23503', null, 'etapa trebuie să aparțină pipeline-ului lead-ului');

select ok((select count(*) > 0 from public.audit_log where record_id = (select v from ctx where k = 'l_g1')),
  'administratorul vede jurnalul de audit al lead-ului');

-- Duplicate: același telefon scris diferit e găsit prin forma normalizată.
with x as (insert into public.contacts (organization_id, first_name)
  values ((select v from ctx where k = 'org'), 'Ion') returning id)
insert into ctx select 'c1', id from x;
with x as (insert into public.contacts (organization_id, first_name)
  values ((select v from ctx where k = 'org'), 'Ion bis') returning id)
insert into ctx select 'c2', id from x;
insert into public.contact_identities (organization_id, contact_id, type, value) values
  ((select v from ctx where k = 'org'), (select v from ctx where k = 'c1'), 'phone', '+373 69 123-456'),
  ((select v from ctx where k = 'org'), (select v from ctx where k = 'c2'), 'phone', '0037369123456');
select is((select count(distinct contact_id)::int from public.contact_identities
           where type = 'phone' and value_normalized = '+37369123456'), 2,
  'telefoanele scrise diferit sunt detectate ca duplicate');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from public.audit_log), 0, 'agentul nu are acces la jurnalul de audit');

select * from finish();
rollback;
