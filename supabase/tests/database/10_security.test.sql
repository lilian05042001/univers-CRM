-- Audit de securitate (Etapa 12): verificări pe întreaga schemă, valabile și pentru tabelele viitoare.
begin;
select plan(9);

select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity $$,
  'RLS e activ pe toate tabelele din public');

select is_empty(
  $$ select t.table_name from information_schema.tables t
     where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
       and t.table_name not in ('organizations', 'profiles')
       and not exists (select 1 from information_schema.columns c
                       where c.table_schema = 'public' and c.table_name = t.table_name
                         and c.column_name = 'organization_id') $$,
  'fiecare tabel de business are organization_id (excepții: organizations, profiles)');

select is_empty(
  $$ select table_name, privilege_type from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public' $$,
  'rolul anon nu are drepturi pe tabele');

select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosecdef
       and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%') $$,
  'funcțiile security definer au search_path fixat');

select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
       and p.proname <> 'get_invitation' $$,
  'rolul anon nu poate apela funcții security definer (excepție: previzualizarea invitației, token de 256 biți)');

select is_empty(
  $$ select tablename, policyname from pg_policies
     where schemaname = 'public'
       and concat(qual, ' ', with_check) ~ 'private\.(is_member|is_admin|has_perm|can_see_record|can_see_conversation|can_read_automations|parents_visible|shares_org)\(' $$,
  'politicile nu apelează funcții evaluate pe fiecare rând (performanța RLS)');

-- Limitarea cererilor: doar serverul (service_role) o poate folosi.
select ok(not has_function_privilege('authenticated', 'public.rate_limit_hit(text, integer, integer)', 'execute'),
  'utilizatorii nu pot consuma limitele altora');

set local role service_role;
select results_eq(
  $$ select allowed from (select (public.rate_limit_hit('test:key', 2, 60)).allowed
                          from generate_series(1, 3)) x $$,
  $$ values (true), (true), (false) $$,
  'a treia cerere peste limita 2 e refuzată');
select ok((select retry_after from public.rate_limit_hit('test:key', 2, 60)) between 1 and 60,
  'răspunsul refuzat spune peste câte secunde se poate reîncerca');
reset role;

select * from finish();
rollback;
