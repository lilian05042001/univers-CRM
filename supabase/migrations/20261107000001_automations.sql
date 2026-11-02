-- =============================================================================
-- Etapa 9 · Motor de automatizări: automations, automation_runs (dedupe), evenimente temporale,
-- execuția acțiunilor (tranzacțională, marcată pentru protecția la bucle), worker prin pg_cron + pg_net.
-- Evaluarea declanșatorilor și a condițiilor: src/lib/automation-engine (worker /api/jobs/automations).
-- =============================================================================

create extension if not exists pg_net;

-- -----------------------------------------------------------------------------
-- Outbox: cheie de deduplicare pentru evenimentele generate periodic + adâncimea lanțului
-- -----------------------------------------------------------------------------
alter table public.domain_events
  add column dedupe_key text,
  add column automation_depth int not null default 0;
create unique index domain_events_dedupe_idx on public.domain_events (dedupe_key) where dedupe_key is not null;

-- Evenimentele produse de o automatizare poartă automatizarea și adâncimea lanțului.
create or replace function private.emit_event(
  p_org uuid, p_type text, p_entity_type text, p_entity_id uuid, p_payload jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.domain_events (organization_id, type, entity_type, entity_id, payload, actor_id,
                                    caused_by_automation_id, automation_depth)
  values (p_org, p_type, p_entity_type, p_entity_id, p_payload, (select auth.uid()),
          nullif(current_setting('app.automation_id', true), '')::uuid,
          coalesce(nullif(current_setting('app.automation_depth', true), '')::int, 0))
$$;
revoke all on function private.emit_event from public;

-- -----------------------------------------------------------------------------
-- Automatizări și execuții
-- -----------------------------------------------------------------------------
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (char_length(description) <= 500),
  trigger_type text not null check (trigger_type in ('lead.created', 'lead.stage_entered', 'lead.won', 'lead.lost',
                                                     'task.due_soon', 'lead.inactive', 'message.received')),
  trigger_config jsonb not null default '{}'::jsonb check (jsonb_typeof(trigger_config) = 'object'),
  conditions jsonb not null default '{"op": "and", "rules": []}'::jsonb check (jsonb_typeof(conditions) = 'object'),
  actions jsonb not null check (jsonb_typeof(actions) = 'array' and jsonb_array_length(actions) between 1 and 10),
  pipeline_id uuid,
  is_active boolean not null default true,
  state jsonb not null default '{}'::jsonb, -- ex. indexul round-robin
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, pipeline_id) references public.pipelines (organization_id, id) on delete cascade
);
create index automations_active_idx on public.automations (organization_id, trigger_type) where is_active;

create table public.automation_runs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  automation_id uuid not null,
  event_id bigint references public.domain_events (id) on delete set null,
  dedupe_key text not null check (char_length(dedupe_key) <= 300),
  entity_type text,
  entity_id uuid,
  status text not null default 'running' check (status in ('running', 'success', 'skipped', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text check (char_length(error) <= 1000),
  result jsonb not null default '{}'::jsonb,
  -- Aceeași automatizare nu rulează de două ori pentru același eveniment / aceeași situație.
  unique (automation_id, dedupe_key),
  foreign key (organization_id, automation_id) references public.automations (organization_id, id) on delete cascade
);
create index automation_runs_org_idx on public.automation_runs (organization_id, started_at desc);
create index automation_runs_automation_idx on public.automation_runs (automation_id, started_at desc);

create trigger set_updated_at before update on public.automations
  for each row execute function private.set_updated_at();
create trigger set_created_by before insert on public.automations
  for each row execute function private.set_created_by();
create trigger audit_row after insert or update or delete on public.automations
  for each row execute function private.audit_row();

create or replace function private.audit_ignored_keys()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['updated_at', 'last_activity_at', 'next_task_due_at', 'position', 'stage_entered_at',
               'token_hash', 'reminder_sent_at', 'overdue_notified_at', 'phone_normalized', 'full_name',
               'search_text', 'last_message_id', 'last_message_at', 'last_message_preview',
               'last_message_direction', 'webhook_secret_hash', 'has_webhook_secret', 'state']
$$;

-- Notificări trimise de automatizări.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('task_due_soon', 'task_overdue', 'task_assigned', 'lead_assigned',
                  'conversation_assigned', 'message_received', 'automation'));
alter table public.notification_preferences drop constraint notification_preferences_type_check;
alter table public.notification_preferences add constraint notification_preferences_type_check
  check (type in ('task_due_soon', 'task_overdue', 'task_assigned', 'lead_assigned',
                  'conversation_assigned', 'message_received', 'automation'));

-- -----------------------------------------------------------------------------
-- Drepturi + RLS: configurare cu automations.manage; citire și pentru cine vede echipa (manager)
-- -----------------------------------------------------------------------------
revoke all on public.automations, public.automation_runs from anon, authenticated;
grant select, delete on public.automations to authenticated;
grant insert (id, organization_id, name, description, trigger_type, trigger_config, conditions, actions,
              pipeline_id, is_active),
  update (name, description, trigger_type, trigger_config, conditions, actions, pipeline_id, is_active)
  on public.automations to authenticated;
grant select on public.automation_runs to authenticated;

alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;

create or replace function private.can_read_automations(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_perm(p_org, 'automations.manage') or private.crm_scope(p_org) in ('all', 'team')
$$;
revoke all on function private.can_read_automations from public;
grant execute on function private.can_read_automations to authenticated;

create policy "read automations" on public.automations for select to authenticated
  using (private.can_read_automations(organization_id));
create policy "automations.manage writes automations" on public.automations for all to authenticated
  using (private.has_perm(organization_id, 'automations.manage'))
  with check (private.has_perm(organization_id, 'automations.manage'));
create policy "read automation runs" on public.automation_runs for select to authenticated
  using (private.can_read_automations(organization_id));

-- -----------------------------------------------------------------------------
-- Worker (service_role): preluare evenimente, automatizări active, instantanee, execuții
-- -----------------------------------------------------------------------------
-- Evenimente neprocesate, blocate 2 minute pentru worker-ul curent (fără dubluri între worker-e).
create or replace function public.claim_domain_events(p_limit int default 50)
returns setof public.domain_events
language sql
security definer
set search_path = ''
as $$
  update public.domain_events
  set locked_until = now() + interval '2 minutes', attempts = attempts + 1
  where id in (
    select id from public.domain_events
    where processed_at is null and (locked_until is null or locked_until < now())
    order by id
    limit least(greatest(p_limit, 1), 500)
    for update skip locked)
  returning *
$$;

-- Succes → procesat. Eroare → reîncercare cu așteptare exponențială, maximum 5 încercări.
create or replace function public.complete_domain_event(p_id bigint, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.domain_events
  set processed_at = case when p_error is null or attempts >= 5 then now() end,
      locked_until = case when p_error is null or attempts >= 5 then null
                          else now() + make_interval(mins => power(2, attempts)::int) end,
      last_error = left(p_error, 1000)
  where id = p_id
$$;

create or replace function public.active_automations(p_orgs uuid[])
returns setof public.automations
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.automations where organization_id = any (p_orgs) and is_active order by created_at
$$;

-- Datele evaluate de condiții: lead-ul (cu etichete) și sarcina, dacă există.
create or replace function public.automation_snapshot(p_lead uuid default null, p_task uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'lead', (select jsonb_build_object(
               'id', l.id, 'title', l.title, 'value', l.value, 'currency', l.currency, 'priority', l.priority,
               'status', l.status, 'pipeline_id', l.pipeline_id, 'stage_id', l.stage_id, 'source_id', l.source_id,
               'responsible_id', l.responsible_id, 'team_id', l.team_id, 'loss_reason_id', l.loss_reason_id,
               'custom_fields', l.custom_fields,
               'tags', coalesce((select jsonb_agg(lt.tag_id) from public.lead_tags lt where lt.lead_id = l.id), '[]'))
             from public.leads l where l.id = p_lead and l.deleted_at is null),
    'task', (select jsonb_build_object(
               'id', t.id, 'title', t.title, 'priority', t.priority, 'status', t.status,
               'responsible_id', t.responsible_id, 'type_key', tt.key, 'lead_id', t.lead_id)
             from public.tasks t join public.task_types tt on tt.id = t.type_id where t.id = p_task))
$$;

-- Începutul unei execuții; null = există deja o execuție cu aceeași cheie (deduplicare).
create or replace function public.automation_start_run(
  p_automation uuid, p_event bigint, p_dedupe_key text, p_entity_type text, p_entity_id uuid)
returns bigint
language sql
security definer
set search_path = ''
as $$
  insert into public.automation_runs (organization_id, automation_id, event_id, dedupe_key, entity_type, entity_id)
  select a.organization_id, a.id, p_event, p_dedupe_key, p_entity_type, p_entity_id
  from public.automations a where a.id = p_automation
  on conflict (automation_id, dedupe_key) do nothing
  returning id
$$;

create or replace function public.automation_finish_run(
  p_run bigint, p_status text, p_result jsonb default '{}'::jsonb, p_error text default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.automation_runs
  set status = p_status, finished_at = now(), result = coalesce(p_result, '{}'::jsonb), error = left(p_error, 1000)
  where id = p_run
$$;

-- Utilizatorii activi din listă, în ordinea dată.
create or replace function private.active_users(p_org uuid, p_ids jsonb)
returns uuid[]
language sql
stable
set search_path = ''
as $$
  select array_agg(m.user_id order by x.ord)
  from jsonb_array_elements_text(coalesce(p_ids, '[]'::jsonb)) with ordinality as x(u, ord)
  join public.memberships m on m.organization_id = p_org and m.status = 'active'
    and m.user_id::text = x.u
$$;

create or replace function private.automation_task(
  p_auto public.automations, p_title text, p_type_id uuid, p_responsible uuid, p_lead uuid, p_contact uuid,
  p_hours int, p_priority text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.tasks (organization_id, type_id, title, responsible_id, lead_id, contact_id, due_at, priority)
  values (p_auto.organization_id,
          coalesce((select id from public.task_types where id = p_type_id and organization_id = p_auto.organization_id),
                   (select id from public.task_types where organization_id = p_auto.organization_id and key = 'follow_up'),
                   (select id from public.task_types where organization_id = p_auto.organization_id order by position limit 1)),
          left(coalesce(nullif(btrim(p_title), ''), p_auto.name), 200),
          (select user_id from public.memberships
           where organization_id = p_auto.organization_id and user_id = p_responsible and status = 'active'),
          p_lead, case when p_lead is null then p_contact end,
          now() + make_interval(hours => least(greatest(coalesce(p_hours, 24), 0), 8760)),
          coalesce(nullif(p_priority, ''), 'normal')::public.lead_priority)
  returning id into v_id;
  return v_id;
end;
$$;

-- O acțiune. Rezultatul ajunge în istoricul execuției.
create or replace function private.automation_action(
  p_auto public.automations, p_action jsonb, p_lead uuid, p_task uuid, p_contact uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_type text := p_action ->> 'type';
  v_lead public.leads;
  v_task public.tasks;
  v_users uuid[];
  v_user uuid;
  v_index int;
  v_target uuid;
  v_id uuid;
begin
  select * into v_lead from public.leads where id = p_lead and deleted_at is null;
  select * into v_task from public.tasks where id = p_task;

  if v_type in ('assign_responsible', 'add_tag', 'change_stage', 'require_loss_reason', 'record_revenue')
     and v_lead.id is null then
    return jsonb_build_object('type', v_type, 'skipped', 'no_lead');
  end if;

  case v_type
  when 'assign_responsible' then
    v_users := private.active_users(p_auto.organization_id, p_action -> 'user_ids');
    if v_users is null then
      return jsonb_build_object('type', v_type, 'skipped', 'no_users');
    end if;
    if p_action ->> 'strategy' = 'least_loaded' then
      select u into v_user from unnest(v_users) with ordinality as x(u, ord)
      order by (select count(*) from public.leads l
                where l.responsible_id = x.u and l.status = 'open' and l.deleted_at is null
                  and l.organization_id = p_auto.organization_id), ord
      limit 1;
    elsif p_action ->> 'strategy' = 'round_robin' then
      select coalesce((state ->> 'next_index')::int, 0) into v_index
      from public.automations where id = p_auto.id for update;
      v_user := v_users[v_index % array_length(v_users, 1) + 1];
      update public.automations set state = jsonb_set(state, '{next_index}', to_jsonb(v_index + 1))
      where id = p_auto.id;
    else
      v_user := v_users[1];
    end if;
    update public.leads set responsible_id = v_user where id = v_lead.id;
    return jsonb_build_object('type', v_type, 'user_id', v_user);

  when 'create_task' then
    v_target := case p_action ->> 'assignee'
                  when 'user' then (p_action ->> 'user_id')::uuid
                  else coalesce(v_lead.responsible_id, v_task.responsible_id) end;
    v_id := private.automation_task(p_auto, p_action ->> 'title', (p_action ->> 'task_type_id')::uuid, v_target,
                                    coalesce(v_lead.id, v_task.lead_id), coalesce(p_contact, v_task.contact_id),
                                    (p_action ->> 'due_in_hours')::int, p_action ->> 'priority');
    return jsonb_build_object('type', v_type, 'task_id', v_id);

  when 'notify' then
    v_target := case p_action ->> 'recipient'
                  when 'user' then (p_action ->> 'user_id')::uuid
                  else coalesce(v_lead.responsible_id, v_task.responsible_id) end;
    if v_target is null or not exists (select 1 from public.memberships
                                       where organization_id = p_auto.organization_id and user_id = v_target
                                         and status = 'active') then
      return jsonb_build_object('type', v_type, 'skipped', 'no_recipient');
    end if;
    perform private.notify(p_auto.organization_id, v_target, 'automation',
      left(coalesce(nullif(btrim(p_action ->> 'message'), ''), p_auto.name), 200),
      coalesce(v_lead.title, v_task.title),
      case when v_lead.id is not null then 'lead' when v_task.id is not null then 'task' end,
      coalesce(v_lead.id, v_task.id),
      case when v_lead.id is not null then '/leads/' || v_lead.id
           when v_task.id is not null then private.task_link(v_task) end);
    return jsonb_build_object('type', v_type, 'user_id', v_target);

  when 'add_tag' then
    insert into public.lead_tags (organization_id, lead_id, tag_id)
    select p_auto.organization_id, v_lead.id, t.id from public.tags t
    where t.id = (p_action ->> 'tag_id')::uuid and t.organization_id = p_auto.organization_id
    on conflict do nothing;
    return jsonb_build_object('type', v_type, 'tag_id', p_action ->> 'tag_id');

  when 'change_stage' then
    -- Doar o etapă din pipeline-ul lead-ului.
    update public.leads set stage_id = s.id
    from public.pipeline_stages s
    where leads.id = v_lead.id and s.id = (p_action ->> 'stage_id')::uuid and s.pipeline_id = v_lead.pipeline_id
      and leads.stage_id <> s.id;
    return jsonb_build_object('type', v_type, 'stage_id', p_action ->> 'stage_id', 'changed', found);

  when 'require_loss_reason' then
    if v_lead.status <> 'lost' or v_lead.loss_reason_id is not null then
      return jsonb_build_object('type', v_type, 'skipped', 'not_needed');
    end if;
    v_id := private.automation_task(p_auto, 'Completează motivul pierderii: ' || v_lead.title, null,
                                    v_lead.responsible_id, v_lead.id, null, 24, 'high');
    perform private.notify(p_auto.organization_id, v_lead.responsible_id, 'automation',
      'Completează motivul pierderii', v_lead.title, 'lead', v_lead.id, '/leads/' || v_lead.id);
    return jsonb_build_object('type', v_type, 'task_id', v_id);

  when 'record_revenue' then
    if v_lead.status <> 'won' then
      return jsonb_build_object('type', v_type, 'skipped', 'not_won');
    end if;
    update public.leads set won_amount = coalesce(won_amount, value) where id = v_lead.id;
    perform private.log_activity(p_auto.organization_id, 'lead.revenue_recorded', v_lead.id, null, null,
      jsonb_build_object('amount', coalesce(v_lead.won_amount, v_lead.value), 'currency', v_lead.currency,
                         'automation', p_auto.name));
    return jsonb_build_object('type', v_type, 'amount', coalesce(v_lead.won_amount, v_lead.value));

  else
    raise exception 'unknown_action %', v_type;
  end case;
end;
$$;

-- Execută acțiunile unei execuții într-o singură subtranzacție: toate sau niciuna.
-- Evenimentele generate de acțiuni poartă automatizarea și adâncimea (protecție la bucle).
create or replace function public.automation_execute(
  p_run bigint, p_actions jsonb, p_depth int,
  p_lead uuid default null, p_task uuid default null, p_contact uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auto public.automations;
  v_action jsonb;
  v_results jsonb := '[]'::jsonb;
  v_status text := 'success';
  v_error text;
begin
  select a.* into v_auto from public.automations a
  join public.automation_runs r on r.automation_id = a.id
  where r.id = p_run;

  perform set_config('app.automation_id', v_auto.id::text, true);
  perform set_config('app.automation_depth', greatest(p_depth, 1)::text, true);
  begin
    for v_action in select * from jsonb_array_elements(p_actions) loop
      v_results := v_results || jsonb_build_array(
        private.automation_action(v_auto, v_action, p_lead, p_task, p_contact));
    end loop;
  exception when others then
    v_status := 'failed';
    v_error := sqlerrm;
    v_results := '[]'::jsonb;
  end;
  perform set_config('app.automation_id', '', true);
  perform set_config('app.automation_depth', '', true);

  perform public.automation_finish_run(p_run, v_status, jsonb_build_object('actions', v_results), v_error);
  return jsonb_build_object('status', v_status, 'error', v_error, 'actions', v_results);
end;
$$;

revoke all on function public.claim_domain_events, public.complete_domain_event, public.active_automations,
  public.automation_snapshot, public.automation_start_run, public.automation_finish_run, public.automation_execute
  from public, anon, authenticated;
grant execute on function public.claim_domain_events, public.complete_domain_event, public.active_automations,
  public.automation_snapshot, public.automation_start_run, public.automation_finish_run, public.automation_execute
  to service_role;
revoke all on function private.active_users, private.automation_task, private.automation_action from public;

-- -----------------------------------------------------------------------------
-- Evenimente temporale (job la fiecare minut), cu cheie deterministă: fără dubluri
-- -----------------------------------------------------------------------------
create or replace function private.generate_time_events()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_due int;
  v_inactive int;
begin
  -- Sarcini care încep în următoarele N minute (N din fiecare automatizare activă).
  insert into public.domain_events (organization_id, type, entity_type, entity_id, payload, dedupe_key)
  select t.organization_id, 'task.due_soon', 'task', t.id,
         jsonb_build_object('minutes', m.minutes, 'due_at', t.due_at, 'lead_id', t.lead_id,
                            'contact_id', t.contact_id, 'responsible_id', t.responsible_id),
         'task:' || t.id || ':due_soon:' || m.minutes || ':' || extract(epoch from t.due_at)::bigint
  from (select distinct organization_id, coalesce((trigger_config ->> 'minutes')::int, 60) as minutes
        from public.automations where is_active and trigger_type = 'task.due_soon') m
  join public.tasks t on t.organization_id = m.organization_id
   and t.status in ('new', 'in_progress')
   and t.due_at > now() and t.due_at <= now() + make_interval(mins => m.minutes)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_due = row_count;

  -- Lead-uri deschise fără activitate de N zile (o dată pe perioadă de inactivitate).
  insert into public.domain_events (organization_id, type, entity_type, entity_id, payload, dedupe_key)
  select l.organization_id, 'lead.inactive', 'lead', l.id,
         jsonb_build_object('days', m.days, 'last_activity_at', l.last_activity_at),
         'lead:' || l.id || ':inactive:' || m.days || ':' || extract(epoch from l.last_activity_at)::bigint
  from (select distinct organization_id, coalesce((trigger_config ->> 'days')::int, 7) as days
        from public.automations where is_active and trigger_type = 'lead.inactive') m
  join public.leads l on l.organization_id = m.organization_id
   and l.status = 'open' and l.deleted_at is null
   and l.last_activity_at <= now() - make_interval(days => m.days)
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_inactive = row_count;

  return v_due + v_inactive;
end;
$$;
revoke all on function private.generate_time_events from public;

-- Worker-ul HTTP (/api/jobs/automations) e apelat doar dacă există evenimente în așteptare.
-- Adresa și secretul stau în Supabase Vault: „jobs_url” și „cron_secret” (fără ele, nu se apelează).
create or replace function private.kick_automation_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.domain_events
                 where processed_at is null and (locked_until is null or locked_until < now())) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'jobs_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/automations',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
end;
$$;
revoke all on function private.kick_automation_worker from public;

-- Curățarea outbox-ului procesat (păstrat 30 de zile).
create or replace function private.cleanup_domain_events()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.domain_events where processed_at < now() - interval '30 days'
$$;
revoke all on function private.cleanup_domain_events from public;

select cron.schedule('automation-time-events', '* * * * *', $$select private.generate_time_events()$$);
select cron.schedule('automation-worker', '15 seconds', $$select private.kick_automation_worker()$$);
select cron.schedule('domain-events-cleanup', '17 3 * * *', $$select private.cleanup_domain_events()$$);
