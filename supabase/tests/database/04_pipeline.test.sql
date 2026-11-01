-- Teste pentru tabla Kanban: rezumatul etapelor, poziția lead-urilor noi, atribuirea automată.
begin;
select plan(9);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.logout() returns void language sql as $$
  reset role;
  select set_config('request.jwt.claims', '', true);
$$;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'a@board.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'g1@board.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'g2@board.test', 'authenticated', 'authenticated');

create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;

select pg_temp.login_as('00000000-0000-0000-0000-0000000000c1');
insert into ctx values ('org', public.create_organization('Board SRL'));
select pg_temp.logout();

insert into public.memberships (organization_id, user_id, role_id)
select (select v from ctx where k = 'org'), u.id, r.id
from (values ('00000000-0000-0000-0000-0000000000c2'::uuid), ('00000000-0000-0000-0000-0000000000c3'::uuid)) as u(id)
join public.roles r on r.organization_id = (select v from ctx where k = 'org') and r.key = 'agent';

insert into ctx select 'pipeline', id from public.pipelines where organization_id = (select v from ctx where k = 'org');
insert into ctx select 'new', id from public.pipeline_stages where pipeline_id = (select v from ctx where k = 'pipeline') and position = 1;
insert into ctx select 'won', id from public.pipeline_stages where pipeline_id = (select v from ctx where k = 'pipeline') and kind = 'won';

create function pg_temp.add_lead(p_title text, p_value numeric, p_responsible uuid, p_stage text default 'new')
returns uuid language sql as $$
  insert into public.leads (organization_id, title, pipeline_id, stage_id, value, responsible_id)
  values ((select v from ctx where k = 'org'), p_title, (select v from ctx where k = 'pipeline'),
          (select v from ctx where k = p_stage), p_value, p_responsible)
  returning id
$$;

-- ---------------------------------------------------------------- rezumat și poziție
select pg_temp.login_as('00000000-0000-0000-0000-0000000000c1');
insert into ctx values ('l1', pg_temp.add_lead('Primul', 1000, '00000000-0000-0000-0000-0000000000c2'));
insert into ctx values ('l2', pg_temp.add_lead('Al doilea', 2000, '00000000-0000-0000-0000-0000000000c3'));
select pg_temp.add_lead('Câștigat', 5000, '00000000-0000-0000-0000-0000000000c2', 'won');
update public.leads set won_amount = 4500 where title = 'Câștigat';

select ok((select position from public.leads where id = (select v from ctx where k = 'l2'))
          < (select position from public.leads where id = (select v from ctx where k = 'l1')),
  'lead-ul nou apare în capul coloanei');

select results_eq(
  $$ select lead_count, total from public.pipeline_summary((select v from ctx where k = 'pipeline'))
     where stage_id = (select v from ctx where k = 'new') $$,
  $$ values (2::bigint, 3000::numeric) $$,
  'administratorul vede numărul și suma tuturor lead-urilor din etapă');
select is((select total from public.pipeline_summary((select v from ctx where k = 'pipeline'))
           where stage_id = (select v from ctx where k = 'won')), 4500::numeric,
  'etapa „Câștigat” însumează suma realizată, nu valoarea estimată');
select is((select lead_count from public.pipeline_summary((select v from ctx where k = 'pipeline'), 'al doilea')
           where stage_id = (select v from ctx where k = 'new')), 1::bigint,
  'rezumatul respectă căutarea');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000c2');
select results_eq(
  $$ select lead_count, total from public.pipeline_summary((select v from ctx where k = 'pipeline'))
     where stage_id = (select v from ctx where k = 'new') $$,
  $$ values (1::bigint, 1000::numeric) $$,
  'agentul vede în rezumat doar lead-urile proprii');

-- ---------------------------------------------------------------- atribuire automată
select pg_temp.login_as('00000000-0000-0000-0000-0000000000c1');
insert into public.assignment_rules (organization_id, pipeline_id, strategy, config)
values ((select v from ctx where k = 'org'), (select v from ctx where k = 'pipeline'), 'round_robin',
        jsonb_build_object('user_ids', jsonb_build_array('00000000-0000-0000-0000-0000000000c2',
                                                         '00000000-0000-0000-0000-0000000000c3')));
-- Inserările se fac separat: o interogare nu vede rândurile inserate de propriile apeluri de funcții.
select pg_temp.add_lead('RR 1', 1, null);
select pg_temp.add_lead('RR 2', 1, null);
select pg_temp.add_lead('RR 3', 1, null);
select results_eq(
  $$ select responsible_id from public.leads where title like 'RR %' order by title $$,
  $$ values ('00000000-0000-0000-0000-0000000000c2'::uuid), ('00000000-0000-0000-0000-0000000000c3'::uuid),
            ('00000000-0000-0000-0000-0000000000c2'::uuid) $$,
  'round-robin distribuie lead-urile pe rând');

update public.assignment_rules set strategy = 'least_loaded' where pipeline_id = (select v from ctx where k = 'pipeline');
-- c2 are acum 4 lead-uri deschise, c3 are 2 → următorul merge la c3
select pg_temp.add_lead('LL', 1, null);
select is((select responsible_id from public.leads where title = 'LL'),
  '00000000-0000-0000-0000-0000000000c3'::uuid, 'lead-ul merge la utilizatorul cel mai puțin încărcat');

update public.assignment_rules set strategy = 'fixed' where pipeline_id = (select v from ctx where k = 'pipeline');
select pg_temp.add_lead('Fix', 1, null);
select is((select responsible_id from public.leads where title = 'Fix'),
  '00000000-0000-0000-0000-0000000000c2'::uuid, 'regula fixă atribuie primul utilizator activ');

-- Agentul creează un lead fără responsabil: atribuirea automată nu cere „leads.assign”.
select pg_temp.login_as('00000000-0000-0000-0000-0000000000c3');
-- Fără RETURNING (ca aplicația): după atribuire, agentul nu mai vede lead-ul colegului.
select lives_ok($$
  insert into public.leads (organization_id, title, pipeline_id, stage_id)
  values ((select v from ctx where k = 'org'), 'De la agent', (select v from ctx where k = 'pipeline'), (select v from ctx where k = 'new'))
$$,
  'agentul poate crea lead-uri distribuite automat colegilor');

select * from finish();
rollback;
