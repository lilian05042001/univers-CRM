-- =============================================================================
-- Etapa 3 · Jurnal de audit, outbox de evenimente (pentru automatizări) și
-- triggerele care alimentează cronologia (activities).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Jurnal de audit: doar INSERT prin trigger, fără UPDATE/DELETE
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid, -- fără FK: jurnalul rămâne intact și după ștergerea utilizatorului
  action text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_record_idx on public.audit_log (organization_id, table_name, record_id, created_at desc);
create index audit_log_org_idx on public.audit_log (organization_id, created_at desc);

-- Câmpuri tehnice sau sensibile, excluse din audit.
create or replace function private.audit_ignored_keys()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['updated_at', 'last_activity_at', 'next_task_due_at', 'position', 'stage_entered_at',
               'token_hash', 'reminder_sent_at', 'phone_normalized', 'full_name']
$$;

create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) - private.audit_ignored_keys() end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) - private.audit_ignored_keys() end;
  v_row jsonb := coalesce(v_new, v_old);
  v_org uuid := case when tg_argv[0] = 'self' then (v_row ->> 'id')::uuid
                     else (v_row ->> 'organization_id')::uuid end;
begin
  -- Ștergerea în cascadă a unei organizații nu se mai auditează (organizația nu mai există).
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations where id = v_org) then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    -- Se păstrează doar câmpurile modificate.
    select jsonb_object_agg(o.key, o.value), jsonb_object_agg(o.key, v_new -> o.key)
    into v_old, v_new
    from jsonb_each(v_old) o
    where v_new -> o.key is distinct from o.value;

    if v_new is null then
      return null; -- s-au schimbat doar câmpuri ignorate
    end if;
  end if;

  insert into public.audit_log (organization_id, actor_id, action, table_name, record_id, old_data, new_data)
  values (v_org, (select auth.uid()), lower(tg_op), tg_table_name, (v_row ->> 'id')::uuid, v_old, v_new);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['roles', 'memberships', 'teams', 'invitations', 'pipelines', 'pipeline_stages',
                           'companies', 'contacts', 'leads', 'tasks']
  loop
    execute format(
      'create trigger audit_row after insert or update or delete on public.%I
         for each row execute function private.audit_row()', t);
  end loop;
end;
$$;
create trigger audit_row after update on public.organizations
  for each row execute function private.audit_row('self');

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
alter table public.audit_log enable row level security;
create policy "settings.manage reads audit log" on public.audit_log for select to authenticated
  using (private.has_perm(organization_id, 'settings.manage'));

-- -----------------------------------------------------------------------------
-- Outbox de evenimente de domeniu (consumat de worker-ul de automatizări, Etapa 9)
-- -----------------------------------------------------------------------------
create table public.domain_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type text not null check (type ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type text not null,
  entity_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid,
  -- setat de motorul de automatizări (set_config('app.automation_id', ...)) pentru prevenirea buclelor
  caused_by_automation_id uuid,
  occurred_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts int not null default 0,
  locked_until timestamptz,
  last_error text
);
create index domain_events_pending_idx on public.domain_events (occurred_at) where processed_at is null;
create index domain_events_entity_idx on public.domain_events (organization_id, entity_type, entity_id);

-- Fără politici: accesibil doar rolului service (worker), niciodată din client.
revoke all on public.domain_events from anon, authenticated;
alter table public.domain_events enable row level security;

create or replace function private.emit_event(
  p_org uuid, p_type text, p_entity_type text, p_entity_id uuid, p_payload jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.domain_events (organization_id, type, entity_type, entity_id, payload, actor_id,
                                    caused_by_automation_id)
  values (p_org, p_type, p_entity_type, p_entity_id, p_payload, (select auth.uid()),
          nullif(current_setting('app.automation_id', true), '')::uuid)
$$;

create or replace function private.log_activity(
  p_org uuid, p_type text, p_lead uuid, p_contact uuid, p_company uuid, p_payload jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activities (organization_id, type, lead_id, contact_id, company_id, actor_id, payload)
  values (p_org, p_type, p_lead, p_contact, p_company, (select auth.uid()), p_payload)
$$;

create or replace function private.touch_lead(p_lead uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.leads set last_activity_at = now() where id = p_lead
$$;

revoke all on function private.emit_event, private.log_activity, private.touch_lead from public;

-- -----------------------------------------------------------------------------
-- Lead-uri → cronologie + evenimente
-- -----------------------------------------------------------------------------
create or replace function private.leads_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb;
  v_field text;
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.organization_id, 'lead.created', new.id, null, null,
      jsonb_build_object('title', new.title, 'stage_id', new.stage_id, 'value', new.value));
    perform private.emit_event(new.organization_id, 'lead.created', 'lead', new.id,
      jsonb_build_object('pipeline_id', new.pipeline_id, 'stage_id', new.stage_id,
                         'responsible_id', new.responsible_id, 'source_id', new.source_id));
    return null;
  end if;

  if new.deleted_at is not null and old.deleted_at is null then
    perform private.log_activity(new.organization_id, 'lead.deleted', new.id, null, null);
    perform private.emit_event(new.organization_id, 'lead.deleted', 'lead', new.id);
    return null;
  end if;

  if new.stage_id is distinct from old.stage_id then
    perform private.log_activity(new.organization_id, 'lead.stage_changed', new.id, null, null,
      jsonb_build_object(
        'from_stage_id', old.stage_id, 'to_stage_id', new.stage_id,
        'from', (select name from public.pipeline_stages where id = old.stage_id),
        'to', (select name from public.pipeline_stages where id = new.stage_id)));
    perform private.emit_event(new.organization_id, 'lead.stage_changed', 'lead', new.id,
      jsonb_build_object('pipeline_id', new.pipeline_id, 'from_stage_id', old.stage_id,
                         'to_stage_id', new.stage_id, 'status', new.status));

    if new.status = 'won' and old.status <> 'won' then
      perform private.emit_event(new.organization_id, 'lead.won', 'lead', new.id,
        jsonb_build_object('won_amount', new.won_amount, 'currency', new.currency));
    elsif new.status = 'lost' and old.status <> 'lost' then
      perform private.emit_event(new.organization_id, 'lead.lost', 'lead', new.id,
        jsonb_build_object('loss_reason_id', new.loss_reason_id));
    end if;
  end if;

  if new.responsible_id is distinct from old.responsible_id then
    perform private.log_activity(new.organization_id, 'lead.responsible_changed', new.id, null, null,
      jsonb_build_object('from', old.responsible_id, 'to', new.responsible_id));
    perform private.emit_event(new.organization_id, 'lead.assigned', 'lead', new.id,
      jsonb_build_object('from', old.responsible_id, 'to', new.responsible_id));
  end if;

  -- Modificări vizibile în „Istoricul modificărilor” din fișa lead-ului.
  v_changes := '{}'::jsonb;
  foreach v_field in array array['title', 'value', 'currency', 'priority', 'company_id', 'source_id',
                                 'team_id', 'won_amount', 'loss_reason_id', 'custom_fields']
  loop
    if to_jsonb(new) -> v_field is distinct from to_jsonb(old) -> v_field then
      v_changes := v_changes || jsonb_build_object(v_field,
        jsonb_build_object('from', to_jsonb(old) -> v_field, 'to', to_jsonb(new) -> v_field));
    end if;
  end loop;
  if new.description is distinct from old.description then
    v_changes := v_changes || jsonb_build_object('description', jsonb_build_object('changed', true));
  end if;
  if v_changes <> '{}'::jsonb then
    perform private.log_activity(new.organization_id, 'lead.updated', new.id, null, null,
      jsonb_build_object('changes', v_changes));
  end if;

  return null;
end;
$$;

create trigger leads_timeline after insert or update on public.leads
  for each row execute function private.leads_timeline();

-- -----------------------------------------------------------------------------
-- Contacte, companii, legături
-- -----------------------------------------------------------------------------
create or replace function private.contacts_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'contacts' then
    perform private.log_activity(new.organization_id, 'contact.created', null, new.id, null,
      jsonb_build_object('name', new.full_name));
    perform private.emit_event(new.organization_id, 'contact.created', 'contact', new.id);
  else
    perform private.log_activity(new.organization_id, 'company.created', null, null, new.id,
      jsonb_build_object('name', new.name));
    perform private.emit_event(new.organization_id, 'company.created', 'company', new.id);
  end if;
  return null;
end;
$$;

create trigger contacts_timeline after insert on public.contacts
  for each row execute function private.contacts_timeline();
create trigger companies_timeline after insert on public.companies
  for each row execute function private.contacts_timeline();

create or replace function private.lead_contacts_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.log_activity(new.organization_id, 'lead.contact_linked', new.lead_id, new.contact_id, null,
    jsonb_build_object('is_primary', new.is_primary));
  return null;
end;
$$;

create trigger lead_contacts_timeline after insert on public.lead_contacts
  for each row execute function private.lead_contacts_timeline();

-- -----------------------------------------------------------------------------
-- Note, fișiere, sarcini → cronologie, ultima interacțiune, evenimente
-- -----------------------------------------------------------------------------
create or replace function private.notes_files_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'notes' then
    perform private.log_activity(new.organization_id, 'note.added', new.lead_id, new.contact_id, new.company_id,
      jsonb_build_object('note_id', new.id, 'excerpt', left(new.body, 200)));
  else
    perform private.log_activity(new.organization_id, 'file.added', new.lead_id, new.contact_id, new.company_id,
      jsonb_build_object('file_id', new.id, 'file_name', new.file_name, 'size_bytes', new.size_bytes));
  end if;
  if new.lead_id is not null then
    perform private.touch_lead(new.lead_id);
  end if;
  return null;
end;
$$;

create trigger notes_timeline after insert on public.notes
  for each row execute function private.notes_files_timeline();
create trigger files_timeline after insert on public.files
  for each row execute function private.notes_files_timeline();

create or replace function private.tasks_timeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := jsonb_build_object('task_id', new.id, 'title', new.title, 'due_at', new.due_at,
                                        'responsible_id', new.responsible_id);
begin
  if tg_op = 'INSERT' then
    perform private.log_activity(new.organization_id, 'task.created', new.lead_id, new.contact_id,
                                 new.company_id, v_payload);
    perform private.emit_event(new.organization_id, 'task.created', 'task', new.id, v_payload);
  elsif new.status is distinct from old.status and new.status in ('done', 'cancelled') then
    perform private.log_activity(new.organization_id, 'task.' || case new.status when 'done' then 'completed'
                                                                   else 'cancelled' end,
                                 new.lead_id, new.contact_id, new.company_id,
                                 v_payload || jsonb_build_object('result', new.result));
    perform private.emit_event(new.organization_id, 'task.' || case new.status when 'done' then 'completed'
                                                               else 'cancelled' end,
                               'task', new.id, v_payload);
    if new.lead_id is not null then
      perform private.touch_lead(new.lead_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger tasks_timeline after insert or update of status on public.tasks
  for each row execute function private.tasks_timeline();
