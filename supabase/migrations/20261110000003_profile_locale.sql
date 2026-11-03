-- =============================================================================
-- Etapa 12 · Limba utilizatorului: null = nicio alegere (decide limba browserului).
-- Până acum 'ro' era doar valoarea implicită, nu o alegere: devine null.
-- La înregistrare, limba interfeței din acel moment vine în metadatele contului.
-- =============================================================================

alter table public.profiles alter column locale drop not null;
alter table public.profiles alter column locale drop default;
update public.profiles set locale = null;

create or replace function private.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profiles (id, email, full_name, locale)
    values (
      new.id,
      lower(new.email),
      coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''),
      case when new.raw_user_meta_data ->> 'locale' in ('ro', 'en', 'ru')
           then new.raw_user_meta_data ->> 'locale' end
    );
  elsif new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end;
$$;
