-- Teste pentru rapoarte (Etapa 10): cifre exacte pe date cunoscute, vizibilitate pe rol, date seed.
begin;
select plan(16);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.logout() returns void language sql as $$
  reset role;
  select set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000b1', 'a@rep.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b2', 'g@rep.test', 'authenticated', 'authenticated');

create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ctx where k = p_key $$;

select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
insert into ctx values ('org', public.create_organization('Rapoarte SRL'));
select pg_temp.logout();
insert into public.memberships (organization_id, user_id, role_id)
select pg_temp.id('org'), '00000000-0000-0000-0000-0000000000b2', id
from public.roles where organization_id = pg_temp.id('org') and key = 'agent';

insert into ctx select 'pipeline', id from public.pipelines where organization_id = pg_temp.id('org');
insert into ctx select 'first', id from public.pipeline_stages where pipeline_id = pg_temp.id('pipeline') and position = 1;
insert into ctx select 'won', id from public.pipeline_stages where pipeline_id = pg_temp.id('pipeline') and kind = 'won';
insert into ctx select 'lost', id from public.pipeline_stages where pipeline_id = pg_temp.id('pipeline') and kind = 'lost';
insert into ctx select 'reason', id from public.loss_reasons where organization_id = pg_temp.id('org') and position = 1;

-- L1 deschis (agent), L2 câștigat (admin), L3 pierdut creat înainte de perioadă (agent), L4 câștigat în EUR (agent).
create function pg_temp.lead(p_title text, p_stage uuid, p_value numeric, p_currency text, p_owner uuid) returns uuid
language sql as $$
  insert into public.leads (organization_id, title, pipeline_id, stage_id, value, currency, responsible_id)
  values ((select v from ctx where k = 'org'), p_title, (select v from ctx where k = 'pipeline'), p_stage, p_value, p_currency, p_owner)
  returning id
$$;
insert into ctx values ('l1', pg_temp.lead('L1', pg_temp.id('first'), 1000, 'MDL', '00000000-0000-0000-0000-0000000000b2'));
insert into ctx values ('l2', pg_temp.lead('L2', pg_temp.id('won'), 5000, 'MDL', '00000000-0000-0000-0000-0000000000b1'));
insert into ctx values ('l3', pg_temp.lead('L3', pg_temp.id('lost'), 2000, 'MDL', '00000000-0000-0000-0000-0000000000b2'));
insert into ctx values ('l4', pg_temp.lead('L4', pg_temp.id('won'), 3000, 'EUR', '00000000-0000-0000-0000-0000000000b2'));
update public.leads set loss_reason_id = pg_temp.id('reason') where id = pg_temp.id('l3');

set local session_replication_role = replica;
update public.leads set created_at = now() - interval '5 days' where id = pg_temp.id('l1');
update public.leads set created_at = now() - interval '10 days', closed_at = now() - interval '2 days' where id = pg_temp.id('l2');
update public.leads set created_at = now() - interval '40 days', closed_at = now() - interval '3 days' where id = pg_temp.id('l3');
update public.leads set created_at = now() - interval '3 days', closed_at = now() - interval '1 day' where id = pg_temp.id('l4');
set local session_replication_role = origin;

-- ---------------------------------------------------------------- administrator: totul
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b1');
select results_eq(
  $$ select new_leads, active_leads, active_value, won_count, won_amount, lost_count, win_rate, avg_cycle_days
     from public.report_kpis((select v from ctx where k = 'org'), now() - interval '30 days', now()) $$,
  $$ values (3, 1, 1000.00::numeric, 2, 5000.00::numeric, 1, 66.7::numeric, 5.0::numeric) $$,
  'indicatorii: noi, active, câștigate (suma doar în MDL), pierdute, rată de câștig, ciclu mediu');
select is((select sum(new_leads)::int from public.report_timeseries((select v from ctx where k = 'org'),
           now() - interval '30 days', now(), 'week')), 3, 'evoluția pe săptămâni însumează lead-urile noi');
select is((select sum(won_amount) from public.report_timeseries((select v from ctx where k = 'org'),
           now() - interval '30 days', now(), 'day')), 5000.00::numeric, 'evoluția pe zile însumează vânzările');
select is((select count(*)::int from public.report_timeseries((select v from ctx where k = 'org'),
           now() - interval '7 days', now(), 'day')), 8, 'o zi per bucket, inclusiv zilele fără date');
select results_eq(
  $$ select reached, current_count from public.report_funnel((select v from ctx where k = 'org'),
       now() - interval '30 days', now(), (select v from ctx where k = 'pipeline'))
     where kind = 'won' or stage_position = 1 order by stage_position $$,
  $$ values (1, 1), (2, 2) $$,
  'pâlnia: lead-urile create în perioadă, pe etape');
select results_eq(
  $$ select won_count, won_amount, open_leads from public.report_by_responsible((select v from ctx where k = 'org'),
       now() - interval '30 days', now())
     where user_id is not null order by name $$,
  $$ values (1, 5000.00::numeric, 0), (1, 0.00::numeric, 1) $$,
  'performanța pe responsabil (admin, apoi agent)');
select results_eq(
  $$ select lost_count, lost_value from public.report_loss_reasons((select v from ctx where k = 'org'),
       now() - interval '30 days', now()) where reason_id = (select v from ctx where k = 'reason') $$,
  $$ values (1, 2000.00::numeric) $$,
  'motivele de pierdere');
select is((select sum(new_leads)::int from public.report_by_source((select v from ctx where k = 'org'),
           now() - interval '30 days', now())), 3, 'sursele (inclusiv „fără sursă”) acoperă toate lead-urile noi');
select results_eq(
  $$ select new_leads, won_count from public.report_kpis((select v from ctx where k = 'org'),
       now() - interval '30 days', now(), p_responsible => '00000000-0000-0000-0000-0000000000b2') $$,
  $$ values (2, 1) $$,
  'filtrul pe responsabil');

-- ---------------------------------------------------------------- agentul: doar înregistrările proprii
select pg_temp.login_as('00000000-0000-0000-0000-0000000000b2');
select results_eq(
  $$ select new_leads, won_count, won_amount, lost_count, win_rate
     from public.report_kpis((select v from ctx where k = 'org'), now() - interval '30 days', now()) $$,
  $$ values (2, 1, 0.00::numeric, 1, 50.0::numeric) $$,
  'agentul vede indicatorii lead-urilor proprii (RLS)');
select is((select won_amount from public.report_by_responsible((select v from ctx where k = 'org'),
           now() - interval '30 days', now()) where user_id = '00000000-0000-0000-0000-0000000000b1'), 0.00::numeric,
  'agentul nu vede vânzările colegilor');
select pg_temp.logout();

-- ---------------------------------------------------------------- datele demo (seed)
-- Cifrele raportului pentru administratorul demo = numărătoarea directă din tabele.
create temp table expected as
select count(*) filter (where created_at >= now() - interval '90 days')::int as new_leads,
       count(*) filter (where status = 'open')::int as active,
       count(*) filter (where status = 'won' and closed_at >= now() - interval '90 days')::int as won,
       coalesce(sum(coalesce(won_amount, value)) filter (where status = 'won' and closed_at >= now() - interval '90 days'), 0) as won_amount,
       count(*) filter (where status = 'lost' and closed_at >= now() - interval '90 days')::int as lost
from public.leads where organization_id = '20000000-0000-0000-0000-000000000001' and deleted_at is null;
grant select on expected to authenticated;

select pg_temp.login_as('10000000-0000-0000-0000-000000000001');
select ok((select new_leads from expected) > 0, 'datele demo există');
select results_eq(
  $$ select new_leads, active_leads, won_count, won_amount, lost_count
     from public.report_kpis('20000000-0000-0000-0000-000000000001', now() - interval '90 days', now()) $$,
  $$ select new_leads, active, won, won_amount, lost from expected $$,
  'indicatorii dashboard-ului corespund datelor demo');
select is((select sum(won_amount) from public.report_timeseries('20000000-0000-0000-0000-000000000001',
           now() - interval '90 days', now(), 'month')), (select won_amount from expected),
  'evoluția lunară a vânzărilor însumează vânzările demo');
select is((select sum(won_amount) from public.report_by_responsible('20000000-0000-0000-0000-000000000001',
           now() - interval '90 days', now())), (select won_amount from expected),
  'vânzările pe responsabil însumează vânzările demo');
select is((select sum(reached)::int from public.report_funnel('20000000-0000-0000-0000-000000000001',
           now() - interval '90 days', now(), (select id from public.pipelines where organization_id = '20000000-0000-0000-0000-000000000001'))
           where stage_position = 1), (select new_leads from expected),
  'toate lead-urile demo noi au intrat în prima etapă a pâlniei');
select pg_temp.logout();

select * from finish();
rollback;
