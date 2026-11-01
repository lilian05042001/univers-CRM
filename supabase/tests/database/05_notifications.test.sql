-- Teste pentru notificările in-app (Etapa 7).
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
  ('00000000-0000-0000-0000-0000000000d1', 'a@notif.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d2', 'g@notif.test', 'authenticated', 'authenticated');

create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;

select pg_temp.login_as('00000000-0000-0000-0000-0000000000d1');
insert into ctx values ('org', public.create_organization('Notif SRL'));
select pg_temp.logout();
insert into public.memberships (organization_id, user_id, role_id)
select (select v from ctx where k = 'org'), '00000000-0000-0000-0000-0000000000d2', id
from public.roles where organization_id = (select v from ctx where k = 'org') and key = 'agent';
insert into ctx select 'type', id from public.task_types
where organization_id = (select v from ctx where k = 'org') and key = 'call';

create function pg_temp.add_task(p_title text, p_due interval, p_responsible uuid) returns uuid language sql as $$
  insert into public.tasks (organization_id, type_id, title, responsible_id, due_at)
  values ((select v from ctx where k = 'org'), (select v from ctx where k = 'type'), p_title, p_responsible, now() + p_due)
  returning id
$$;

-- ---------------------------------------------------------------- atribuire
select pg_temp.login_as('00000000-0000-0000-0000-0000000000d1');
insert into ctx values ('soon', pg_temp.add_task('Apel curând', interval '10 minutes', '00000000-0000-0000-0000-0000000000d2'));
insert into ctx values ('late', pg_temp.add_task('Apel întârziat', interval '-1 hour', '00000000-0000-0000-0000-0000000000d2'));
insert into ctx values ('self', pg_temp.add_task('Pentru mine', interval '-1 hour', '00000000-0000-0000-0000-0000000000d1'));
select pg_temp.logout();

select is((select count(*)::int from public.notifications where type = 'task_assigned'
           and user_id = '00000000-0000-0000-0000-0000000000d2'), 2,
  'agentul e notificat de sarcinile atribuite de un coleg');
select is((select count(*)::int from public.notifications where type = 'task_assigned'
           and user_id = '00000000-0000-0000-0000-0000000000d1'), 0,
  'nu primești notificare pentru o sarcină pe care ți-o atribui singur');

-- ---------------------------------------------------------------- job periodic
-- Se numără doar notificările organizației de test (job-ul procesează toate organizațiile).
select private.generate_task_notifications();
select is((select count(*)::int from public.notifications where organization_id = (select v from ctx where k = 'org') and type in ('task_due_soon', 'task_overdue')), 3,
  'job-ul notifică sarcina apropiată și cele două întârziate');
select private.generate_task_notifications();
select is((select count(*)::int from public.notifications where organization_id = (select v from ctx where k = 'org') and type in ('task_due_soon', 'task_overdue')), 3, 'a doua rulare nu duplică notificările');
select results_eq(
  $$ select type from public.notifications where entity_id = (select v from ctx where k = 'soon') order by type $$,
  $$ values ('task_assigned'), ('task_due_soon') $$,
  'sarcina apropiată primește notificarea „în curând”');

update public.tasks set due_at = now() - interval '5 minutes' where id = (select v from ctx where k = 'soon');
select private.generate_task_notifications();
select is((select count(*)::int from public.notifications where organization_id = (select v from ctx where k = 'org') and type in ('task_due_soon', 'task_overdue')), 4, 'termenul mutat permite o nouă notificare (întârziată)');

-- ---------------------------------------------------------------- preferințe și vizibilitate
insert into public.notification_preferences (organization_id, user_id, type, in_app)
values ((select v from ctx where k = 'org'), '00000000-0000-0000-0000-0000000000d2', 'task_overdue', false);
select pg_temp.add_task('Fără notificare', interval '-1 hour', '00000000-0000-0000-0000-0000000000d2');
select private.generate_task_notifications();
select is((select count(*)::int from public.notifications n join public.tasks t on t.id = n.entity_id
           where t.title = 'Fără notificare' and n.type = 'task_overdue'), 0,
  'preferința dezactivată oprește notificarea');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000d2');
select is((select count(*)::int from public.notifications
           where user_id <> '00000000-0000-0000-0000-0000000000d2'), 0,
  'fiecare își vede doar notificările proprii');
update public.notifications set read_at = now();
select is((select count(*)::int from public.notifications where read_at is null), 0,
  'utilizatorul își poate marca notificările ca citite');

select * from finish();
rollback;
