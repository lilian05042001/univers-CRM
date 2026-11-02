-- Teste pentru Inbox (Etapa 8): ingestie, identificare contact, idempotență, RLS, atribuire, necitite.
begin;
select plan(37);

create function pg_temp.login_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;
create function pg_temp.logout() returns void language sql as $$
  reset role;
  select set_config('request.jwt.claims', '', true);
$$;

-- a = admin, m = manager, g1 = agent în echipa managerului, g2 = agent fără echipă, x = altă organizație
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'a@inbox.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e2', 'm@inbox.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e3', 'g1@inbox.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e4', 'g2@inbox.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e5', 'x@inbox.test', 'authenticated', 'authenticated');

create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;
create temp table res (k text primary key, v jsonb);
grant all on res to authenticated;
create function pg_temp.id(p_key text) returns uuid language sql as $$ select v from ctx where k = p_key $$;

select pg_temp.login_as('00000000-0000-0000-0000-0000000000e5');
insert into ctx values ('org_x', public.create_organization('Altă Firmă Inbox'));
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1');
insert into ctx values ('org', public.create_organization('Inbox SRL'));
select pg_temp.logout();

insert into public.memberships (organization_id, user_id, role_id)
select pg_temp.id('org'), u.id, r.id
from (values ('00000000-0000-0000-0000-0000000000e2'::uuid, 'manager'),
             ('00000000-0000-0000-0000-0000000000e3'::uuid, 'agent'),
             ('00000000-0000-0000-0000-0000000000e4'::uuid, 'agent')) as u(id, role_key)
join public.roles r on r.organization_id = pg_temp.id('org') and r.key = u.role_key;
with t as (insert into public.teams (organization_id, name, manager_id)
  values (pg_temp.id('org'), 'Echipa', '00000000-0000-0000-0000-0000000000e2') returning id)
insert into public.team_members (organization_id, team_id, user_id)
select pg_temp.id('org'), id, '00000000-0000-0000-0000-0000000000e3' from t;

insert into ctx select 'channel', id from public.channels where organization_id = pg_temp.id('org') and provider = 'internal';
with c as (insert into public.contacts (organization_id, first_name, last_name, owner_id)
  values (pg_temp.id('org'), 'Maria', 'Client', '00000000-0000-0000-0000-0000000000e4') returning id)
insert into ctx select 'contact', id from c;
insert into public.contact_identities (organization_id, contact_id, type, value, is_primary)
values (pg_temp.id('org'), pg_temp.id('contact'), 'phone', '+373 69 111 222', true);

-- ---------------------------------------------------------------- ingestie
select is((select count(*)::int from public.channels where organization_id = pg_temp.id('org') and provider = 'internal'), 1,
  'organizația nouă are canalul intern');

insert into res values ('m1', public.ingest_inbound_message(pg_temp.id('channel'),
  '{"identity_type": "phone", "identity_value": "+37369111222", "body": "Bună ziua", "external_id": "e-1"}'));
select is((select (v ->> 'contact_id')::uuid from res where k = 'm1'), pg_temp.id('contact'),
  'telefonul (alt format) identifică contactul existent');
select is((select (v ->> 'contact_created')::boolean from res where k = 'm1'), false, 'nu se creează un contact duplicat');
insert into ctx select 'conv', (v ->> 'conversation_id')::uuid from res where k = 'm1';
select is((select assignee_id from public.conversations where id = pg_temp.id('conv')),
  '00000000-0000-0000-0000-0000000000e4'::uuid, 'conversația e atribuită responsabilului contactului');

insert into res values ('m1_again', public.ingest_inbound_message(pg_temp.id('channel'),
  '{"identity_type": "phone", "identity_value": "+37369111222", "body": "Bună ziua", "external_id": "e-1"}'));
select is((select v ->> 'message_id' from res where k = 'm1_again'), (select v ->> 'message_id' from res where k = 'm1'),
  'același mesaj extern nu se înregistrează de două ori');
select is((select count(*)::int from public.messages where conversation_id = pg_temp.id('conv')), 1,
  'conversația are un singur mesaj după reluare');

insert into res values ('wa', public.ingest_inbound_message(pg_temp.id('channel'),
  '{"identity_type": "whatsapp", "identity_value": "0037369111222", "body": "Revin", "external_id": "e-2"}'));
select is((select (v ->> 'conversation_id')::uuid from res where k = 'wa'), pg_temp.id('conv'),
  'WhatsApp cu același număr ajunge în aceeași conversație');

insert into res values ('new', public.ingest_inbound_message(pg_temp.id('channel'),
  '{"identity_type": "email", "identity_value": "Nou@Exemplu.md", "sender_name": "Ion Nou", "body": "O ofertă, vă rog", "external_id": "e-3"}'));
insert into ctx select 'conv_new', (v ->> 'conversation_id')::uuid from res where k = 'new';
select ok((select (v ->> 'contact_created')::boolean from res where k = 'new'), 'expeditor necunoscut → contact nou');
select is((select c.full_name from public.contacts c join res on res.k = 'new' and c.id = (res.v ->> 'contact_id')::uuid),
  'Ion Nou', 'contactul nou primește numele expeditorului');

select is((select count(*)::int from public.activities where contact_id = pg_temp.id('contact') and type = 'message.received'), 2,
  'mesajele primite apar în cronologia contactului');
select is((select count(*)::int from public.domain_events where organization_id = pg_temp.id('org') and type = 'message.received'), 3,
  'fiecare mesaj primit emite evenimentul message.received');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select public.ingest_inbound_message((select v from ctx where k = 'channel'), '{}') $$,
  '42501', null, 'ingestia nu poate fi apelată din client');
select pg_temp.logout();

-- A treia conversație, atribuită agentului din echipă.
with c as (insert into public.conversations (organization_id, channel_id, contact_id, assignee_id, external_thread_id, display_name)
  values (pg_temp.id('org'), pg_temp.id('channel'), pg_temp.id('contact'), '00000000-0000-0000-0000-0000000000e3', 't-3', 'Maria')
  returning id)
insert into ctx select 'conv_g1', id from c;

-- ---------------------------------------------------------------- vizibilitate
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from public.conversations), 3, 'administratorul vede toate conversațiile');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e2');
select is((select count(*)::int from public.conversations), 2, 'managerul vede conversațiile echipei și pe cele neatribuite');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e3');
select is((select count(*)::int from public.conversations), 2, 'agentul vede conversațiile proprii și pe cele neatribuite');
select is((select count(*)::int from public.messages), 1, 'agentul vede doar mesajele conversațiilor vizibile');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e5');
select is((select count(*)::int from public.conversations) + (select count(*)::int from public.messages), 0,
  'altă organizație nu vede nimic');

-- ---------------------------------------------------------------- atribuire
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e3');
select lives_ok($$ update public.conversations set assignee_id = '00000000-0000-0000-0000-0000000000e3'
                   where id = (select v from ctx where k = 'conv_new') $$,
  'agentul preia o conversație neatribuită');
select throws_ok($$ update public.conversations set assignee_id = '00000000-0000-0000-0000-0000000000e4'
                    where id = (select v from ctx where k = 'conv_g1') $$,
  '42501', 'assign_forbidden', 'agentul nu poate atribui conversația altui coleg');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e2');
select lives_ok($$ select public.assign_conversation((select v from ctx where k = 'conv_g1'),
                                                       '00000000-0000-0000-0000-0000000000e4') $$,
  'managerul (inbox.assign) predă conversația unui agent din afara echipei');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e3');
select throws_ok($$ select public.assign_conversation((select v from ctx where k = 'conv_new'),
                                                        '00000000-0000-0000-0000-0000000000e4') $$,
  '42501', 'assign_forbidden', 'nici prin RPC agentul nu atribuie altcuiva');
select pg_temp.logout();
select is((select count(*)::int from public.notifications
           where user_id = '00000000-0000-0000-0000-0000000000e4' and type = 'conversation_assigned'), 2,
  'responsabilul e notificat la fiecare atribuire (automată sau de un coleg)');

-- ---------------------------------------------------------------- mesaje
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e4');
insert into public.messages (organization_id, conversation_id, body)
values (pg_temp.id('org'), pg_temp.id('conv'), 'Vă răspundem imediat');
select results_eq(
  $$ select sender_user_id, direction, delivery_status from public.messages
     where conversation_id = (select v from ctx where k = 'conv') and body = 'Vă răspundem imediat' $$,
  $$ values ('00000000-0000-0000-0000-0000000000e4'::uuid, 'out', 'sent') $$,
  'expeditorul e utilizatorul curent; pe canalul intern mesajul e trimis imediat');
insert into public.messages (organization_id, conversation_id, kind, body)
values (pg_temp.id('org'), pg_temp.id('conv'), 'internal_note', 'Client important');
select is((select last_message_preview from public.conversations where id = pg_temp.id('conv')), 'Vă răspundem imediat',
  'nota internă nu devine ultimul mesaj al conversației');
select is((select count(*)::int from public.inbox_unread_counts(array[(select v from ctx where k = 'conv')])), 0,
  'după răspuns, conversația e citită de autor');
select lives_ok($$ insert into public.messages (organization_id, conversation_id, direction, body)
                   values ((select v from ctx where k = 'org'), (select v from ctx where k = 'conv'), 'in', 'A sunat clientul') $$,
  'pe canalul intern se poate înregistra manual un mesaj primit');
update public.conversations set status = 'closed' where id = pg_temp.id('conv');
select pg_temp.logout();

select public.ingest_inbound_message(pg_temp.id('channel'),
  '{"identity_type": "phone", "identity_value": "+37369111222", "body": "Încă o întrebare", "external_id": "e-4"}');
select is((select status from public.conversations where id = pg_temp.id('conv')), 'open',
  'un mesaj nou redeschide conversația închisă');
select is((select count(*)::int from public.notifications
           where user_id = '00000000-0000-0000-0000-0000000000e4' and type = 'message_received'), 3,
  'responsabilul e notificat de mesajele primite de la client');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000e4');
select is((select unread from public.inbox_unread_counts(array[(select v from ctx where k = 'conv')])), 1,
  'mesajele primite după ultima citire sunt necitite');
select public.mark_conversation_read(pg_temp.id('conv'));
select is((select count(*)::int from public.inbox_unread_counts(array[(select v from ctx where k = 'conv')])), 0,
  'marcarea ca citită golește necititele');
select pg_temp.logout();

-- Pe un canal extern, mesajele primite vin doar prin webhook.
with ch as (insert into public.channels (organization_id, provider, name)
  values (pg_temp.id('org'), 'whatsapp', 'WhatsApp') returning id),
c as (insert into public.conversations (organization_id, channel_id, assignee_id, display_name)
  select pg_temp.id('org'), id, '00000000-0000-0000-0000-0000000000e4', 'WA' from ch returning id)
insert into ctx select 'conv_wa', id from c;
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e4');
select throws_ok($$ insert into public.messages (organization_id, conversation_id, direction, body)
                    values ((select v from ctx where k = 'org'), (select v from ctx where k = 'conv_wa'), 'in', 'Fals') $$,
  '42501', null, 'pe un canal extern nu se poate falsifica un mesaj primit');
insert into public.messages (organization_id, conversation_id, body)
values (pg_temp.id('org'), pg_temp.id('conv_wa'), 'Răspuns WA');
select is((select delivery_status from public.messages where body = 'Răspuns WA'), 'queued',
  'pe un canal extern răspunsul așteaptă livrarea');

-- ---------------------------------------------------------------- atașamente, răspunsuri rapide, secrete
insert into res select 'msg', to_jsonb(id) from public.messages where conversation_id = pg_temp.id('conv') limit 1;
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e3');
select throws_ok($$ insert into public.files (organization_id, message_id, storage_path, file_name, mime_type, size_bytes)
                    values ((select v from ctx where k = 'org'), (select v::text::bigint from res where k = 'msg'),
                            (select v from ctx where k = 'org') || '/conversation/x/a.pdf', 'a.pdf', 'application/pdf', 10) $$,
  '42501', null, 'nu se pot atașa fișiere la mesaje invizibile');
select throws_ok($$ insert into public.quick_replies (organization_id, title, body)
                    values ((select v from ctx where k = 'org'), 'Partajat', 'Text') $$,
  '42501', null, 'agentul nu poate crea răspunsuri rapide partajate');
insert into public.quick_replies (organization_id, title, body, owner_id)
values (pg_temp.id('org'), 'Al meu', 'Text', '00000000-0000-0000-0000-0000000000e3');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1');
insert into public.quick_replies (organization_id, title, body) values (pg_temp.id('org'), 'Partajat', 'Text');
select pg_temp.login_as('00000000-0000-0000-0000-0000000000e4');
select is((select array_agg(title order by title) from public.quick_replies), array['Partajat'],
  'fiecare vede răspunsurile partajate și pe cele proprii');

select pg_temp.login_as('00000000-0000-0000-0000-0000000000e1');
select throws_ok($$ select webhook_secret_hash from public.channels $$, '42501', null,
  'hash-ul cheii webhook nu poate fi citit din client');
select throws_ok($$ select count(*) from public.webhook_events $$, '42501', null,
  'jurnalul webhook nu e accesibil din client');
select pg_temp.logout();

select * from finish();
rollback;
