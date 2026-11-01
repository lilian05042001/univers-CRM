-- =============================================================================
-- Etapa 7 · Notificări in-app: sarcini apropiate, întârziate, sarcini atribuite.
-- Generate în DB (trigger + job pg_cron la fiecare minut), livrate prin Realtime.
-- =============================================================================

create extension if not exists pg_cron;

create table public.notifications (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('task_due_soon', 'task_overdue', 'task_assigned', 'lead_assigned')),
  title text not null,
  body text,
  entity_type text check (entity_type in ('lead', 'contact', 'company', 'task')),
  entity_id uuid,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.notification_preferences (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('task_due_soon', 'task_overdue', 'task_assigned', 'lead_assigned')),
  in_app boolean not null default true,
  primary key (organization_id, user_id, type)
);

-- Marcaj „notificat ca întârziată” (o singură dată per termen).
alter table public.tasks add column overdue_notified_at timestamptz;

-- -----------------------------------------------------------------------------
-- Drepturi + RLS: fiecare își vede și își marchează doar notificările proprii.
-- -----------------------------------------------------------------------------
revoke all on public.notifications, public.notification_preferences from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update (in_app), delete on public.notification_preferences to authenticated;

alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

create policy "own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and private.is_member(organization_id));
create policy "mark own notifications" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own notifications" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "own preferences" on public.notification_preferences for all to authenticated
  using (user_id = (select auth.uid()) and private.is_member(organization_id))
  with check (user_id = (select auth.uid()) and private.is_member(organization_id));

alter publication supabase_realtime add table public.notifications;

-- -----------------------------------------------------------------------------
-- Creare (respectă preferințele; implicit activat)
-- -----------------------------------------------------------------------------
create or replace function private.notify(
  p_org uuid, p_user uuid, p_type text, p_title text, p_body text,
  p_entity_type text, p_entity_id uuid, p_link text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (organization_id, user_id, type, title, body, entity_type, entity_id, link)
  select p_org, p_user, p_type, p_title, p_body, p_entity_type, p_entity_id, p_link
  where p_user is not null
    and coalesce((select in_app from public.notification_preferences
                  where organization_id = p_org and user_id = p_user and type = p_type), true)
$$;
revoke all on function private.notify from public;

/** Linkul unei sarcini: fișa înregistrării de care ține, altfel lista de sarcini. */
create or replace function private.task_link(t public.tasks)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when t.lead_id is not null then '/leads/' || t.lead_id
    when t.contact_id is not null then '/contacts/' || t.contact_id
    when t.company_id is not null then '/companies/' || t.company_id
    else '/tasks'
  end
$$;

-- Sarcină atribuită altcuiva decât autorul acțiunii; lead atribuit altcuiva.
create or replace function private.notify_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'tasks' then
    if new.responsible_id is not null
       and new.responsible_id is distinct from (select auth.uid())
       and (tg_op = 'INSERT' or new.responsible_id is distinct from old.responsible_id) then
      perform private.notify(new.organization_id, new.responsible_id, 'task_assigned', new.title, null,
                             'task', new.id, private.task_link(new));
    end if;
  elsif new.responsible_id is not null
        and new.responsible_id is distinct from (select auth.uid())
        and (tg_op = 'INSERT' or new.responsible_id is distinct from old.responsible_id) then
    perform private.notify(new.organization_id, new.responsible_id, 'lead_assigned', new.title, null,
                           'lead', new.id, '/leads/' || new.id);
  end if;
  return null;
end;
$$;

create trigger tasks_notify_assignment after insert or update of responsible_id on public.tasks
  for each row execute function private.notify_assignment();
create trigger leads_notify_assignment after insert or update of responsible_id on public.leads
  for each row execute function private.notify_assignment();

-- Termen mutat: sarcina poate fi notificată din nou (înainte de scriere, fără UPDATE suplimentar).
create or replace function private.tasks_reset_reminders()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.due_at is distinct from old.due_at or new.reminder_at is distinct from old.reminder_at then
    new.reminder_sent_at := null;
    new.overdue_notified_at := null;
  end if;
  return new;
end;
$$;

create trigger tasks_reset_reminders before update of due_at, reminder_at on public.tasks
  for each row execute function private.tasks_reset_reminders();

-- Marcajele de notificare nu intră în jurnalul de audit.
create or replace function private.audit_ignored_keys()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['updated_at', 'last_activity_at', 'next_task_due_at', 'position', 'stage_entered_at',
               'token_hash', 'reminder_sent_at', 'overdue_notified_at', 'phone_normalized', 'full_name',
               'search_text']
$$;

-- -----------------------------------------------------------------------------
-- Job periodic: sarcini care încep în 15 minute (sau la reminder_at) și sarcini întârziate.
-- Marcajele reminder_sent_at / overdue_notified_at previn notificările duble.
-- -----------------------------------------------------------------------------
create or replace function private.generate_task_notifications()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tasks;
  v_count int := 0;
begin
  for t in
    select * from public.tasks
    where status in ('new', 'in_progress')
      and reminder_sent_at is null
      and due_at > now()
      and coalesce(reminder_at, due_at - interval '15 minutes') <= now()
    for update skip locked
  loop
    perform private.notify(t.organization_id, t.responsible_id, 'task_due_soon', t.title, null,
                           'task', t.id, private.task_link(t));
    update public.tasks set reminder_sent_at = now() where id = t.id;
    v_count := v_count + 1;
  end loop;

  for t in
    select * from public.tasks
    where status in ('new', 'in_progress')
      and overdue_notified_at is null
      and due_at <= now()
    for update skip locked
  loop
    perform private.notify(t.organization_id, t.responsible_id, 'task_overdue', t.title, null,
                           'task', t.id, private.task_link(t));
    update public.tasks set overdue_notified_at = now() where id = t.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
revoke all on function private.generate_task_notifications from public;

select cron.schedule('task-notifications', '* * * * *', $$select private.generate_task_notifications()$$);
