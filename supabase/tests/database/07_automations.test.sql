-- Teste pentru motorul de automatizări (Etapa 9): RLS, execuție, deduplicare, bucle, evenimente temporale.
begin;
select plan(20);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.logout() returns void language sql as $$
  reset role;
  select set_config('request.jwt.claims', '', true);
$$;

-- a = admin, m = manager, g1/g2 = agenți
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000f1', 'a@auto.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f2', 'm@auto.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f3', 'g1@auto.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f4', 'g2@auto.test', 'authenticated', 'authenticated');

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v::uuid from ctx where k = p_key $$;

select pg_temp.login_as('00000000-0000-0000-0000-0000000000f1');
insert into ctx values ('org', public.create_organization('Auto SRL'));
select pg_temp.logout();
insert into public.memberships (organization_id, user_id, role_id)
select pg_temp.id('org'), u.id, r.id
from (values ('00000000-0000-0000-0000-0000000000f2'::uuid, 'manager'),
             ('00000000-0000-0000-0000-0000000000f3'::uuid, 'agent'),
             ('00000000-0000-0000-0000-0000000000f4'::uuid, 'agent')) as u(id, role_key)
join public.roles r on r.organization_id = pg_temp.id('org') and r.key = u.role_key;
insert into ctx select 'pipeline', id from public.pipelines where organization_id = pg_temp.id('org');
insert into ctx select 'stage_first', id from public.pipeline_stages where pipeline_id = pg_temp.id('pipeline') and position = 1;
insert into ctx select 'stage_neg', id from public.pipeline_stages where pipeline_id = pg_temp.id('pipeline') and position = 6;

-- Automatizare de atribuire pe rând (g1, g2) + sarcină la intrarea în Negociere.
with a as (insert into public.automations (organization_id, name, trigger_type, actions)
  values (pg_temp.id('org'), 'Atribuire', 'lead.created',
          '[{"type": "assign_responsible", "strategy": "round_robin",
             "user_ids": ["00000000-0000-0000-0000-0000000000f3", "00000000-0000-0000-0000-0000000000f4"]}]')
  returning id)
insert into ctx select 'auto_assign', id from a;
with a as (insert into public.automations (organization_id, name, trigger_type, trigger_config, actions)
  values (pg_temp.id('org'), 'Sarcină', 'lead.stage_entered', jsonb_build_object('stage_id', pg_temp.id('stage_neg')),
          '[{"type": "create_task", "title": "Pregătește contractul", "assignee": "lead_responsible", "due_in_hours": 24},
            {"type": "change_stage", "stage_id": "00000000-0000-0000-0000-000000000000"}]')
  returning id)
insert into ctx select 'auto_task', id from a;

-- ---------------------------------------------------------------- RLS
select pg_temp.login_as('00000000-0000-0000-0000-0000000000f3');
select is((select count(*)::int from public.automations), 0, 'agentul nu vede automatizările');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000f2');
select is((select count(*)::int from public.automations), 2, 'managerul vede automatizările (citire)');
select throws_ok($$ insert into public.automations (organization_id, name, trigger_type, actions)
                    values ((select v::uuid from ctx where k = 'org'), 'X', 'lead.won', '[{"type": "record_revenue"}]') $$,
  '42501', null, 'managerul nu poate crea automatizări');
select throws_ok($$ select public.claim_domain_events(10) $$, '42501', null, 'worker-ul nu poate fi apelat din client');
select pg_temp.logout();

-- ---------------------------------------------------------------- execuție + deduplicare
insert into public.leads (organization_id, title, pipeline_id, stage_id)
values (pg_temp.id('org'), 'Lead 1', pg_temp.id('pipeline'), pg_temp.id('stage_first')),
       (pg_temp.id('org'), 'Lead 2', pg_temp.id('pipeline'), pg_temp.id('stage_first'));
insert into ctx select 'lead1', id from public.leads where title = 'Lead 1' and organization_id = pg_temp.id('org');
insert into ctx select 'lead2', id from public.leads where title = 'Lead 2' and organization_id = pg_temp.id('org');
insert into ctx select 'event1', id::text from public.domain_events where entity_id = pg_temp.id('lead1') and type = 'lead.created';

insert into ctx select 'run1', public.automation_start_run(pg_temp.id('auto_assign'), (select v::bigint from ctx where k = 'event1'),
  'event:' || (select v from ctx where k = 'event1'), 'lead', pg_temp.id('lead1'))::text;
select ok((select v from ctx where k = 'run1') is not null, 'prima execuție pentru eveniment pornește');
select is(public.automation_start_run(pg_temp.id('auto_assign'), (select v::bigint from ctx where k = 'event1'),
  'event:' || (select v from ctx where k = 'event1'), 'lead', pg_temp.id('lead1')), null,
  'a doua execuție cu aceeași cheie e refuzată (deduplicare)');

select is(public.automation_execute((select v::bigint from ctx where k = 'run1'),
  (select actions from public.automations where id = pg_temp.id('auto_assign')), 1, pg_temp.id('lead1')) ->> 'status',
  'success', 'acțiunile se execută');
select is((select responsible_id from public.leads where id = pg_temp.id('lead1')),
  '00000000-0000-0000-0000-0000000000f3'::uuid, 'primul lead merge la primul agent');

insert into ctx select 'run2', public.automation_start_run(pg_temp.id('auto_assign'), null, 'manual:2', 'lead', pg_temp.id('lead2'))::text;
select public.automation_execute((select v::bigint from ctx where k = 'run2'),
  (select actions from public.automations where id = pg_temp.id('auto_assign')), 1, pg_temp.id('lead2'));
select is((select responsible_id from public.leads where id = pg_temp.id('lead2')),
  '00000000-0000-0000-0000-0000000000f4'::uuid, 'al doilea lead merge la al doilea agent (pe rând)');

select results_eq(
  $$ select caused_by_automation_id, automation_depth from public.domain_events
     where entity_id = (select v::uuid from ctx where k = 'lead1') and type = 'lead.assigned' $$,
  $$ select (select v::uuid from ctx where k = 'auto_assign'), 1 $$,
  'evenimentele produse de automatizare poartă automatizarea și adâncimea (protecție la bucle)');
select is((select count(*)::int from public.notifications
           where user_id = '00000000-0000-0000-0000-0000000000f3' and type = 'lead_assigned'), 1,
  'agentul e notificat de lead-ul atribuit automat');
select is((select actor_id from public.activities where lead_id = pg_temp.id('lead1') and type = 'lead.responsible_changed'),
  null, 'în cronologie, autorul atribuirii e sistemul');

-- Atomicitate: a doua acțiune (etapă din alt pipeline) nu schimbă nimic; o acțiune necunoscută anulează tot.
update public.leads set stage_id = pg_temp.id('stage_neg') where id = pg_temp.id('lead1');
insert into ctx select 'run3', public.automation_start_run(pg_temp.id('auto_task'), null, 'manual:3', 'lead', pg_temp.id('lead1'))::text;
select is(public.automation_execute((select v::bigint from ctx where k = 'run3'),
  (select actions from public.automations where id = pg_temp.id('auto_task')), 1, pg_temp.id('lead1')) ->> 'status',
  'success', 'sarcina se creează la intrarea în etapă');
select is((select responsible_id from public.tasks where lead_id = pg_temp.id('lead1') and title = 'Pregătește contractul'),
  '00000000-0000-0000-0000-0000000000f3'::uuid, 'sarcina e atribuită responsabilului lead-ului');

insert into ctx select 'run4', public.automation_start_run(pg_temp.id('auto_task'), null, 'manual:4', 'lead', pg_temp.id('lead2'))::text;
select is(public.automation_execute((select v::bigint from ctx where k = 'run4'),
  '[{"type": "create_task", "title": "Nu trebuie să rămână"}, {"type": "inexistent"}]', 1, pg_temp.id('lead2')) ->> 'status',
  'failed', 'o acțiune invalidă face execuția să eșueze');
select is((select count(*)::int from public.tasks where title = 'Nu trebuie să rămână'), 0,
  'acțiunile unei execuții eșuate sunt anulate (toate sau niciuna)');
select is((select status from public.automation_runs where id = (select v::bigint from ctx where k = 'run4')), 'failed',
  'eroarea apare în istoricul execuțiilor');

-- ---------------------------------------------------------------- evenimente temporale
insert into public.automations (organization_id, name, trigger_type, trigger_config, actions)
values (pg_temp.id('org'), 'Inactiv', 'lead.inactive', '{"days": 7}', '[{"type": "notify"}]');
update public.leads set last_activity_at = now() - interval '10 days' where id = pg_temp.id('lead2');
select private.generate_time_events();
select private.generate_time_events();
select is((select count(*)::int from public.domain_events where type = 'lead.inactive' and entity_id = pg_temp.id('lead2')), 1,
  'lead-ul inactiv produce un singur eveniment, oricâte rulări');

-- ---------------------------------------------------------------- outbox
select is((select count(*)::int from public.claim_domain_events(500) where organization_id = pg_temp.id('org')) > 0, true,
  'worker-ul preia evenimentele în așteptare');
select is((select count(*)::int from public.claim_domain_events(500) where organization_id = pg_temp.id('org')), 0,
  'evenimentele preluate sunt blocate pentru alt worker');

select * from finish();
rollback;
