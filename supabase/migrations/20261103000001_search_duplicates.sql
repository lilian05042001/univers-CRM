-- =============================================================================
-- Etapa 4 · Căutare fără diacritice, detectarea duplicatelor, unirea contactelor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Coloane de căutare (aplicația normalizează termenul la fel: lowercase, fără diacritice)
-- -----------------------------------------------------------------------------
alter table public.contacts
  add column search_text text generated always as (private.search_norm(first_name || ' ' || last_name)) stored;
alter table public.companies
  add column search_text text generated always as (private.search_norm(name)) stored;
alter table public.leads
  add column search_text text generated always as (private.search_norm(title)) stored;

drop index public.contacts_name_trgm;
drop index public.companies_name_trgm;
drop index public.leads_title_trgm;
create index contacts_search_trgm on public.contacts using gin (search_text extensions.gin_trgm_ops);
create index companies_search_trgm on public.companies using gin (search_text extensions.gin_trgm_ops);
create index leads_search_trgm on public.leads using gin (search_text extensions.gin_trgm_ops);
create index contact_identities_search_trgm on public.contact_identities
  using gin (value_normalized extensions.gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Duplicate: caută în toată organizația, dar numele apare doar dacă e vizibil
-- utilizatorului (agentul e avertizat fără să vadă datele colegilor).
-- -----------------------------------------------------------------------------
create or replace function public.find_contact_duplicates(
  p_org uuid, p_identities jsonb, p_exclude uuid default null)
returns table (contact_id uuid, full_name text, matched_type text, matched_value text, is_visible boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_member(p_org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select distinct on (c.id, ci.type)
         c.id,
         case when private.can_see_record(c.organization_id, c.owner_id, null) then c.full_name end,
         ci.type,
         ci.value,
         private.can_see_record(c.organization_id, c.owner_id, null)
  from jsonb_to_recordset(coalesce(p_identities, '[]'::jsonb)) as q(type text, value text)
  join public.contact_identities ci
    on ci.organization_id = p_org
   and ci.type = q.type
   and ci.value_normalized = private.normalize_identity(q.type, q.value)
  join public.contacts c on c.id = ci.contact_id and c.deleted_at is null
  where private.normalize_identity(q.type, q.value) <> ''
    and c.id is distinct from p_exclude
  limit 20;
end;
$$;

create or replace function public.find_company_duplicates(
  p_org uuid, p_name text, p_phone text default null, p_email text default null, p_exclude uuid default null)
returns table (company_id uuid, name text, matched_type text, is_visible boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_member(p_org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select c.id,
         case when private.can_see_record(c.organization_id, c.owner_id, null) then c.name end,
         case
           when c.search_text = private.search_norm(p_name) then 'name'
           when c.phone_normalized = nullif(private.normalize_identity('phone', p_phone), '') then 'phone'
           else 'email'
         end,
         private.can_see_record(c.organization_id, c.owner_id, null)
  from public.companies c
  where c.organization_id = p_org
    and c.deleted_at is null
    and c.id is distinct from p_exclude
    and (c.search_text = private.search_norm(p_name)
         or c.phone_normalized = nullif(private.normalize_identity('phone', p_phone), '')
         or c.email = nullif(lower(btrim(p_email)), ''))
  limit 20;
end;
$$;

-- -----------------------------------------------------------------------------
-- Unirea a două contacte: totul trece pe contactul păstrat, celălalt e șters logic.
-- -----------------------------------------------------------------------------
create or replace function public.merge_contacts(p_keep uuid, p_remove uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keep public.contacts;
  v_remove public.contacts;
  r record;
begin
  select * into v_keep from public.contacts where id = p_keep and deleted_at is null for update;
  select * into v_remove from public.contacts where id = p_remove and deleted_at is null for update;

  if v_keep.id is null or v_remove.id is null or p_keep = p_remove
     or v_keep.organization_id <> v_remove.organization_id then
    raise exception 'merge_invalid' using errcode = 'P0001';
  end if;
  if not (private.has_perm(v_keep.organization_id, 'contacts.edit')
          and private.has_perm(v_keep.organization_id, 'contacts.delete')
          and private.can_see_record(v_keep.organization_id, v_keep.owner_id, null)
          and private.can_see_record(v_remove.organization_id, v_remove.owner_id, null)) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Identități: se mută cele care nu există deja pe contactul păstrat.
  delete from public.contact_identities ci
  where ci.contact_id = p_remove
    and exists (select 1 from public.contact_identities k
                where k.contact_id = p_keep and k.type = ci.type and k.value_normalized = ci.value_normalized);
  update public.contact_identities set contact_id = p_keep, is_primary = false where contact_id = p_remove;

  -- Lead-uri: legătura se mută; rolul de contact principal se păstrează.
  for r in delete from public.lead_contacts where contact_id = p_remove returning * loop
    insert into public.lead_contacts (organization_id, lead_id, contact_id, is_primary, role)
    values (r.organization_id, r.lead_id, p_keep, r.is_primary, r.role)
    on conflict (lead_id, contact_id)
    do update set is_primary = public.lead_contacts.is_primary or excluded.is_primary;
  end loop;

  insert into public.contact_tags (organization_id, contact_id, tag_id)
  select organization_id, p_keep, tag_id from public.contact_tags where contact_id = p_remove
  on conflict do nothing;
  delete from public.contact_tags where contact_id = p_remove;

  update public.notes set contact_id = p_keep where contact_id = p_remove;
  update public.files set contact_id = p_keep where contact_id = p_remove;
  update public.tasks set contact_id = p_keep where contact_id = p_remove;
  update public.activities set contact_id = p_keep where contact_id = p_remove;

  update public.contacts
  set company_id = coalesce(company_id, v_remove.company_id),
      position = coalesce(position, v_remove.position),
      source_id = coalesce(source_id, v_remove.source_id),
      owner_id = coalesce(owner_id, v_remove.owner_id),
      custom_fields = v_remove.custom_fields || custom_fields
  where id = p_keep;

  update public.contacts set deleted_at = now() where id = p_remove;

  perform private.log_activity(v_keep.organization_id, 'contact.merged', null, p_keep, null,
    jsonb_build_object('merged_contact_id', p_remove, 'merged_name', v_remove.full_name));
  return p_keep;
end;
$$;

revoke all on function public.find_contact_duplicates, public.find_company_duplicates, public.merge_contacts
  from public, anon;
grant execute on function public.find_contact_duplicates, public.find_company_duplicates, public.merge_contacts
  to authenticated;
