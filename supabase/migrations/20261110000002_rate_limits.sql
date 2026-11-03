-- =============================================================================
-- Etapa 12 · Limitarea cererilor (autentificare, API public, webhooks).
-- Contor cu ferestre fixe în Postgres: funcționează la fel pe oricâte instanțe serverless.
-- Tabel tehnic în schema private (neexpusă prin API), fără date de business.
-- =============================================================================

create table private.rate_limits (
  key text not null check (char_length(key) <= 300),
  window_start timestamptz not null,
  hits int not null default 1,
  primary key (key, window_start)
);

-- Înregistrează o cerere pentru cheie; allowed = false dacă fereastra curentă a depășit limita.
-- Apelată doar de server (service_role): un client nu poate consuma limitele altcuiva.
create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns table (allowed boolean, retry_after int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into private.rate_limits as r (key, window_start)
  values (left(p_key, 300), v_start)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  return query select
    v_hits <= p_limit,
    case when v_hits <= p_limit then 0
         else greatest(1, ceil(extract(epoch from v_start + make_interval(secs => p_window_seconds) - now()))::int)
    end;
end;
$$;

revoke all on function public.rate_limit_hit from public, anon, authenticated;
grant execute on function public.rate_limit_hit to service_role;

create or replace function private.cleanup_rate_limits()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.rate_limits where window_start < now() - interval '1 day'
$$;

select cron.schedule('rate-limits-cleanup', '23 * * * *', $$select private.cleanup_rate_limits()$$);
