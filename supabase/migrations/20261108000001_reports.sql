-- =============================================================================
-- Etapa 10 · Rapoarte și dashboard: funcții SQL agregate, security invoker (respectă RLS:
-- fiecare vede cifrele înregistrărilor pe care le vede). Perioade [p_from, p_to), sume doar
-- în moneda organizației (lead-urile în altă monedă intră în numărători, nu în sume).
-- =============================================================================

-- Lead-urile vizibile, filtrate (pipeline, responsabil, echipă, sursă).
create or replace function private.report_leads(
  p_org uuid, p_pipeline uuid, p_responsible uuid, p_team uuid, p_source uuid)
returns setof public.leads
language sql
stable
security invoker
set search_path = ''
as $$
  select l.* from public.leads l
  where l.organization_id = p_org and l.deleted_at is null
    and (p_pipeline is null or l.pipeline_id = p_pipeline)
    and (p_responsible is null or l.responsible_id = p_responsible)
    and (p_team is null or l.team_id = p_team)
    and (p_source is null or l.source_id = p_source)
$$;
grant execute on function private.report_leads to authenticated;

create or replace function private.org_currency(p_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select currency from public.organizations where id = p_org
$$;
create or replace function private.org_timezone(p_org uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select timezone from public.organizations where id = p_org
$$;
revoke all on function private.org_currency, private.org_timezone from public;
grant execute on function private.org_currency, private.org_timezone to authenticated;

-- -----------------------------------------------------------------------------
-- Indicatori: lead-uri noi, active, câștigate / pierdute, rată de câștig, ciclu, sarcini
-- -----------------------------------------------------------------------------
create or replace function public.report_kpis(
  p_org uuid, p_from timestamptz, p_to timestamptz,
  p_pipeline uuid default null, p_responsible uuid default null, p_team uuid default null,
  p_source uuid default null)
returns table (
  new_leads int, active_leads int, active_value numeric, won_count int, won_amount numeric,
  lost_count int, win_rate numeric, avg_cycle_days numeric, tasks_overdue int, tasks_today int)
language sql
stable
security invoker
set search_path = ''
as $$
  with l as (select * from private.report_leads(p_org, p_pipeline, p_responsible, p_team, p_source)),
  cur as (select private.org_currency(p_org) as c, private.org_timezone(p_org) as tz),
  closed as (select * from l where closed_at >= p_from and closed_at < p_to),
  t as (select * from public.tasks
        where organization_id = p_org and status in ('new', 'in_progress')
          and (p_responsible is null or responsible_id = p_responsible))
  select
    (select count(*)::int from l where created_at >= p_from and created_at < p_to),
    (select count(*)::int from l where status = 'open'),
    (select coalesce(sum(value), 0) from l, cur where status = 'open' and currency = cur.c),
    (select count(*)::int from closed where status = 'won'),
    (select coalesce(sum(coalesce(won_amount, value)), 0) from closed, cur where status = 'won' and currency = cur.c),
    (select count(*)::int from closed where status = 'lost'),
    (select case when count(*) = 0 then null
                 else round(100.0 * count(*) filter (where status = 'won') / count(*), 1) end
     from closed where status in ('won', 'lost')),
    (select round(avg(extract(epoch from closed_at - created_at) / 86400)::numeric, 1)
     from closed where status = 'won'),
    (select count(*)::int from t where due_at < now()),
    (select count(*)::int from t, cur
     where (due_at at time zone cur.tz)::date = (now() at time zone cur.tz)::date)
$$;

-- -----------------------------------------------------------------------------
-- Evoluție pe zile / săptămâni / luni (în fusul organizației)
-- -----------------------------------------------------------------------------
create or replace function public.report_timeseries(
  p_org uuid, p_from timestamptz, p_to timestamptz, p_bucket text,
  p_pipeline uuid default null, p_responsible uuid default null, p_team uuid default null,
  p_source uuid default null)
returns table (bucket date, new_leads int, won_count int, won_amount numeric, lost_count int)
language sql
stable
security invoker
set search_path = ''
as $$
  with cfg as (
    select private.org_timezone(p_org) as tz, private.org_currency(p_org) as c,
           case when p_bucket in ('day', 'week', 'month') then p_bucket else 'day' end as unit),
  l as (select * from private.report_leads(p_org, p_pipeline, p_responsible, p_team, p_source)),
  b as (
    select generate_series(
             date_trunc(cfg.unit, p_from at time zone cfg.tz),
             date_trunc(cfg.unit, (p_to - interval '1 microsecond') at time zone cfg.tz),
             ('1 ' || cfg.unit)::interval)::date as bucket
    from cfg)
  select b.bucket,
         (select count(*)::int from l, cfg
          where l.created_at >= p_from and l.created_at < p_to
            and date_trunc(cfg.unit, l.created_at at time zone cfg.tz)::date = b.bucket),
         (select count(*)::int from l, cfg
          where l.status = 'won' and l.closed_at >= p_from and l.closed_at < p_to
            and date_trunc(cfg.unit, l.closed_at at time zone cfg.tz)::date = b.bucket),
         (select coalesce(sum(coalesce(l.won_amount, l.value)), 0) from l, cfg
          where l.status = 'won' and l.currency = cfg.c and l.closed_at >= p_from and l.closed_at < p_to
            and date_trunc(cfg.unit, l.closed_at at time zone cfg.tz)::date = b.bucket),
         (select count(*)::int from l, cfg
          where l.status = 'lost' and l.closed_at >= p_from and l.closed_at < p_to
            and date_trunc(cfg.unit, l.closed_at at time zone cfg.tz)::date = b.bucket)
  from b
  order by b.bucket
$$;

-- -----------------------------------------------------------------------------
-- Pâlnie: câte lead-uri create în perioadă au intrat în fiecare etapă + situația curentă
-- -----------------------------------------------------------------------------
create or replace function public.report_funnel(
  p_org uuid, p_from timestamptz, p_to timestamptz, p_pipeline uuid,
  p_responsible uuid default null, p_team uuid default null, p_source uuid default null)
returns table (stage_id uuid, name text, color text, kind text, stage_position int,
               reached int, current_count int, current_value numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with l as (
    select * from private.report_leads(p_org, p_pipeline, p_responsible, p_team, p_source)
    where created_at >= p_from and created_at < p_to)
  select s.id, s.name, s.color, s.kind::text, s.position,
         (select count(distinct h.lead_id)::int from public.lead_stage_history h
          join l on l.id = h.lead_id where h.to_stage_id = s.id),
         (select count(*)::int from l where l.stage_id = s.id),
         (select coalesce(sum(l.value), 0) from l where l.stage_id = s.id and l.currency = private.org_currency(p_org))
  from public.pipeline_stages s
  where s.pipeline_id = p_pipeline and s.organization_id = p_org
  order by s.position
$$;

-- -----------------------------------------------------------------------------
-- Performanța angajaților
-- -----------------------------------------------------------------------------
create or replace function public.report_by_responsible(
  p_org uuid, p_from timestamptz, p_to timestamptz,
  p_pipeline uuid default null, p_team uuid default null, p_source uuid default null)
returns table (user_id uuid, name text, new_leads int, open_leads int, open_value numeric,
               won_count int, won_amount numeric, lost_count int, tasks_done int, tasks_overdue int)
language sql
stable
security invoker
set search_path = ''
as $$
  with l as (select * from private.report_leads(p_org, p_pipeline, null, p_team, p_source)),
  c as (select private.org_currency(p_org) as c),
  people as (
    select m.user_id, coalesce(nullif(p.full_name, ''), p.email) as name
    from public.memberships m join public.profiles p on p.id = m.user_id
    where m.organization_id = p_org and m.status = 'active'
    union all select null, null)
  select pe.user_id, pe.name,
         (select count(*)::int from l where l.responsible_id is not distinct from pe.user_id
            and l.created_at >= p_from and l.created_at < p_to),
         (select count(*)::int from l where l.responsible_id is not distinct from pe.user_id and l.status = 'open'),
         (select coalesce(sum(l.value), 0) from l, c where l.responsible_id is not distinct from pe.user_id
            and l.status = 'open' and l.currency = c.c),
         (select count(*)::int from l where l.responsible_id is not distinct from pe.user_id and l.status = 'won'
            and l.closed_at >= p_from and l.closed_at < p_to),
         (select coalesce(sum(coalesce(l.won_amount, l.value)), 0) from l, c
          where l.responsible_id is not distinct from pe.user_id and l.status = 'won' and l.currency = c.c
            and l.closed_at >= p_from and l.closed_at < p_to),
         (select count(*)::int from l where l.responsible_id is not distinct from pe.user_id and l.status = 'lost'
            and l.closed_at >= p_from and l.closed_at < p_to),
         (select count(*)::int from public.tasks t where t.organization_id = p_org
            and t.responsible_id is not distinct from pe.user_id and t.status = 'done'
            and t.completed_at >= p_from and t.completed_at < p_to),
         (select count(*)::int from public.tasks t where t.organization_id = p_org
            and t.responsible_id is not distinct from pe.user_id and t.status in ('new', 'in_progress')
            and t.due_at < now())
  from people pe
$$;

-- -----------------------------------------------------------------------------
-- Surse, motive de pierdere, activități
-- -----------------------------------------------------------------------------
create or replace function public.report_by_source(
  p_org uuid, p_from timestamptz, p_to timestamptz,
  p_pipeline uuid default null, p_responsible uuid default null, p_team uuid default null)
returns table (source_id uuid, name text, new_leads int, won_count int, won_amount numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with l as (select * from private.report_leads(p_org, p_pipeline, p_responsible, p_team, null)),
  c as (select private.org_currency(p_org) as c),
  src as (select s.id, s.name, s.position from public.lead_sources s where s.organization_id = p_org
          union all select null, null, 1000)
  select src.id, src.name,
         (select count(*)::int from l where l.source_id is not distinct from src.id
            and l.created_at >= p_from and l.created_at < p_to),
         (select count(*)::int from l where l.source_id is not distinct from src.id and l.status = 'won'
            and l.closed_at >= p_from and l.closed_at < p_to),
         (select coalesce(sum(coalesce(l.won_amount, l.value)), 0) from l, c
          where l.source_id is not distinct from src.id and l.status = 'won' and l.currency = c.c
            and l.closed_at >= p_from and l.closed_at < p_to)
  from src
  order by src.position
$$;

create or replace function public.report_loss_reasons(
  p_org uuid, p_from timestamptz, p_to timestamptz,
  p_pipeline uuid default null, p_responsible uuid default null, p_team uuid default null,
  p_source uuid default null)
returns table (reason_id uuid, name text, lost_count int, lost_value numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with l as (
    select * from private.report_leads(p_org, p_pipeline, p_responsible, p_team, p_source)
    where status = 'lost' and closed_at >= p_from and closed_at < p_to)
  select r.id, r.name, count(l.id)::int,
         coalesce(sum(l.value) filter (where l.currency = private.org_currency(p_org)), 0)
  from (select id, name, position from public.loss_reasons where organization_id = p_org
        union all select null, null, 1000) r
  left join l on l.loss_reason_id is not distinct from r.id
  group by r.id, r.name, r.position
  order by r.position
$$;

create or replace function public.report_activities(
  p_org uuid, p_from timestamptz, p_to timestamptz, p_responsible uuid default null)
returns table (type_id uuid, name text, planned int, done int, overdue int)
language sql
stable
security invoker
set search_path = ''
as $$
  select tt.id, tt.name,
         count(t.id) filter (where t.due_at >= p_from and t.due_at < p_to)::int,
         count(t.id) filter (where t.status = 'done' and t.completed_at >= p_from and t.completed_at < p_to)::int,
         count(t.id) filter (where t.status in ('new', 'in_progress') and t.due_at < now())::int
  from public.task_types tt
  left join public.tasks t on t.type_id = tt.id
    and (p_responsible is null or t.responsible_id = p_responsible)
  where tt.organization_id = p_org
  group by tt.id, tt.name, tt.position
  order by tt.position
$$;

revoke all on function public.report_kpis, public.report_timeseries, public.report_funnel,
  public.report_by_responsible, public.report_by_source, public.report_loss_reasons, public.report_activities
  from public, anon;
grant execute on function public.report_kpis, public.report_timeseries, public.report_funnel,
  public.report_by_responsible, public.report_by_source, public.report_loss_reasons, public.report_activities
  to authenticated;

-- Indexuri pentru agregări pe perioadă.
create index if not exists leads_closed_idx on public.leads (organization_id, closed_at) where closed_at is not null;
create index if not exists tasks_completed_idx on public.tasks (organization_id, completed_at) where completed_at is not null;
