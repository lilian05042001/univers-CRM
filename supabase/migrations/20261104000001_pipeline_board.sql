-- =============================================================================
-- Etapa 5 · Kanban: rezumat pe etape, poziția lead-urilor noi, atribuire automată.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Rezumatul coloanelor (număr + sumă), cu aceleași filtre ca tabla.
-- security invoker: se însumează doar lead-urile vizibile utilizatorului (RLS).
-- Suma: valoarea estimată pentru etapele deschise / pierdute, suma realizată pentru „câștigat”.
-- -----------------------------------------------------------------------------
create or replace function public.pipeline_summary(
  p_pipeline uuid,
  p_search text default null,
  p_responsible text default null, -- 'me' | 'none' | uuid
  p_priority public.lead_priority default null)
returns table (stage_id uuid, lead_count bigint, total numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.stage_id,
         count(*),
         coalesce(sum(case when l.status = 'won' then coalesce(l.won_amount, l.value) else l.value end), 0)
  from public.leads l
  where l.pipeline_id = p_pipeline
    and l.deleted_at is null
    and (p_search is null or l.search_text like '%' || private.search_norm(p_search) || '%')
    and (p_priority is null or l.priority = p_priority)
    and (p_responsible is null
         or (p_responsible = 'me' and l.responsible_id = (select auth.uid()))
         or (p_responsible = 'none' and l.responsible_id is null)
         or (p_responsible ~ '^[0-9a-f-]{36}$' and l.responsible_id = p_responsible::uuid))
  group by l.stage_id
$$;

revoke all on function public.pipeline_summary from public, anon;
grant execute on function public.pipeline_summary to authenticated;

-- -----------------------------------------------------------------------------
-- Lead nou: în capul coloanei + responsabil după regula de atribuire a pipeline-ului.
-- Rulează după leads_before_write (ordinea triggerelor e alfabetică), deci verificarea
-- „leads.assign” nu se aplică atribuirii automate.
-- -----------------------------------------------------------------------------
create or replace function private.leads_auto_assign()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.assignment_rules;
  v_users uuid[];
  v_index int;
begin
  if new.position = 0 then
    select coalesce(min(position), 0) - 1 into new.position
    from public.leads where stage_id = new.stage_id and deleted_at is null;
  end if;

  if new.responsible_id is not null then
    return new;
  end if;

  select * into v_rule from public.assignment_rules
  where pipeline_id = new.pipeline_id and is_active
  for update;
  if not found then
    return new;
  end if;

  -- Doar utilizatorii încă activi în organizație, în ordinea din regulă.
  select array_agg(u order by ord) into v_users
  from jsonb_array_elements_text(coalesce(v_rule.config -> 'user_ids', '[]'::jsonb)) with ordinality as x(u, ord)
  join public.memberships m
    on m.organization_id = new.organization_id and m.user_id = x.u::uuid and m.status = 'active';
  if v_users is null then
    return new;
  end if;

  if v_rule.strategy = 'fixed' then
    new.responsible_id := v_users[1];
  elsif v_rule.strategy = 'least_loaded' then
    select u into new.responsible_id
    from unnest(v_users) with ordinality as x(u, ord)
    order by (select count(*) from public.leads l
              where l.responsible_id = x.u and l.status = 'open' and l.deleted_at is null
                and l.organization_id = new.organization_id), ord
    limit 1;
  else -- round_robin
    v_index := coalesce((v_rule.config ->> 'next_index')::int, 0) % array_length(v_users, 1);
    new.responsible_id := v_users[v_index + 1];
    update public.assignment_rules
    set config = jsonb_set(config, '{next_index}', to_jsonb(v_index + 1))
    where id = v_rule.id;
  end if;

  return new;
end;
$$;

create trigger leads_zz_auto_assign before insert on public.leads
  for each row execute function private.leads_auto_assign();
